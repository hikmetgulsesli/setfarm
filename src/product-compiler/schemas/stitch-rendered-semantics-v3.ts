import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  EvidenceIdSchema,
  ObservableIdSchema,
  RouteIdSchema,
  Sha256Schema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ControlSlotIdSchema } from "./common-v2.js";
import {
  ActionInputCodecIdV2Schema,
} from "./action-input-transport-v2.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import { DesignSourceGenerationRequestV3Schema } from "./design-source-generation-request-v3.js";

export const STITCH_RENDERED_SEMANTICS_ARTIFACT_TYPE_V3 =
  "setfarm.stitch-rendered-semantics.v3" as const;
export const STITCH_RENDERED_SEMANTICS_POLICY_V3 =
  "direct-response-composite-static-contract-projection.v3" as const;
export const STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3 = 100;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isStrictlySorted(values: readonly string[]): boolean {
  return values.every((value, index) =>
    index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

function requireUniqueSorted(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string,
): void {
  if (!hasUniqueStrings(values) || !isStrictlySorted(values)) {
    context.addIssue({
      code: "custom",
      path,
      message: `${label} must be unique and canonically UTF-16 sorted`,
    });
  }
}

function requireCanonicalHash(
  actual: string,
  payload: unknown,
  context: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  try {
    if (actual === hashCanonicalJson(payload)) return;
  } catch {
    // A refinement must remain total for malformed public input. The caller's
    // schema issues still describe the malformed child; this adds the failed
    // integrity boundary without throwing out of safeParse.
  }
  context.addIssue({ code: "custom", path, message });
}

export const StitchRenderedSemanticsVerificationBoundaryV3Schema = z.object({
  artifactReproduction: z.literal("deterministic_exact"),
  casRetrieval: z.literal("unverified_external_bytes"),
  browserReplay: z.literal("unverified_not_performed"),
}).strict();

const ControlAuthorityBindingV3Schema = z.object({
  controlSlotRef: ControlSlotIdSchema,
  actionRef: ActionIdSchema,
  controlPlacementHash: Sha256Schema,
  actionInputTransportsHash: Sha256Schema,
}).strict();

const ActionAuthorityBindingV3Schema = z.object({
  actionRef: ActionIdSchema,
  actionHash: Sha256Schema,
}).strict();

const EvidenceAuthorityBindingV3Schema = z.object({
  evidenceRef: EvidenceIdSchema,
  evidenceHash: Sha256Schema,
}).strict();

const ObservableAuthorityBindingV3Schema = z.object({
  observableRef: ObservableIdSchema,
  actionRef: ActionIdSchema,
  observableHash: Sha256Schema,
  selectorHash: Sha256Schema,
}).strict();

const ActionInputAuthorityBindingV3Schema = z.object({
  controlSlotRef: ControlSlotIdSchema,
  actionInputRef: z.string().min(3).max(500),
  transportHash: Sha256Schema,
}).strict();

const SurfaceAuthorityBindingV3Schema = z.object({
  surfaceRef: SurfaceIdSchema,
  ownership: z.enum(["route_root", "contained"]),
  surfaceHash: Sha256Schema,
}).strict();

const StitchRenderedTargetAuthorityPayloadV3Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  targetHash: Sha256Schema,
  routeRef: RouteIdSchema,
  routeHash: Sha256Schema,
  rootSurfaceRef: SurfaceIdSchema,
  containedSurfaceRefs: z.array(SurfaceIdSchema).max(1_000),
  surfaces: z.array(SurfaceAuthorityBindingV3Schema).min(1).max(1_001),
  surfacesHash: Sha256Schema,
  controls: z.array(ControlAuthorityBindingV3Schema).max(2_000),
  controlsHash: Sha256Schema,
  actions: z.array(ActionAuthorityBindingV3Schema).max(2_000),
  actionsHash: Sha256Schema,
  evidencePredicates: z.array(EvidenceAuthorityBindingV3Schema).max(5_000),
  evidencePredicatesHash: Sha256Schema,
  observables: z.array(ObservableAuthorityBindingV3Schema).max(2_000),
  observablesHash: Sha256Schema,
  actionInputTransports: z.array(ActionInputAuthorityBindingV3Schema).max(10_000),
  actionInputTransportsHash: Sha256Schema,
}).strict();

export type StitchRenderedTargetAuthorityPayloadV3 = z.infer<
  typeof StitchRenderedTargetAuthorityPayloadV3Schema
>;

export function hashStitchRenderedTargetAuthorityV3(
  value: StitchRenderedTargetAuthorityPayloadV3,
): string {
  return hashCanonicalJson(StitchRenderedTargetAuthorityPayloadV3Schema.parse(value));
}

export const StitchRenderedTargetAuthorityV3Schema =
  StitchRenderedTargetAuthorityPayloadV3Schema.extend({
    authorityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    requireUniqueSorted(
      value.containedSurfaceRefs,
      context,
      ["containedSurfaceRefs"],
      "Contained surface authority identities",
    );
    requireUniqueSorted(
      value.surfaces.map((entry) => entry.surfaceRef),
      context,
      ["surfaces"],
      "Surface authority identities",
    );
    const expectedSurfaceRefs = [value.rootSurfaceRef, ...value.containedSurfaceRefs]
      .sort(compareUtf16);
    if (
      value.surfaces.length !== expectedSurfaceRefs.length
      || value.surfaces.some((surface, index) =>
        surface.surfaceRef !== expectedSurfaceRefs[index]
        || surface.ownership
          !== (surface.surfaceRef === value.rootSurfaceRef ? "route_root" : "contained"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["surfaces"],
        message: "RENDERED_SEMANTICS_V3_SURFACE_AUTHORITY_CLOSURE_MISMATCH",
      });
    }
    requireUniqueSorted(
      value.controls.map((entry) => entry.controlSlotRef),
      context,
      ["controls"],
      "Control authority identities",
    );
    requireUniqueSorted(
      value.actions.map((entry) => entry.actionRef),
      context,
      ["actions"],
      "Action authority identities",
    );
    requireUniqueSorted(
      value.evidencePredicates.map((entry) => entry.evidenceRef),
      context,
      ["evidencePredicates"],
      "Evidence authority identities",
    );
    requireUniqueSorted(
      value.observables.map((entry) => entry.observableRef),
      context,
      ["observables"],
      "Observable authority identities",
    );
    requireUniqueSorted(
      value.actionInputTransports.map((entry) =>
        `${entry.controlSlotRef}\0${entry.actionInputRef}`),
      context,
      ["actionInputTransports"],
      "Action-input authority identities",
    );
    for (const [path, actual, projection] of [
      ["surfacesHash", value.surfacesHash, value.surfaces],
      ["controlsHash", value.controlsHash, value.controls],
      ["actionsHash", value.actionsHash, value.actions],
      [
        "evidencePredicatesHash",
        value.evidencePredicatesHash,
        value.evidencePredicates,
      ],
      ["observablesHash", value.observablesHash, value.observables],
      [
        "actionInputTransportsHash",
        value.actionInputTransportsHash,
        value.actionInputTransports,
      ],
    ] as const) {
      requireCanonicalHash(
        actual,
        projection,
        context,
        [path],
        `${path} must bind its exact ordered target authority projection`,
      );
    }
    const { authorityHash: _authorityHash, ...payload } = value;
    requireCanonicalHash(
      value.authorityHash,
      payload,
      context,
      ["authorityHash"],
      "RENDERED_SEMANTICS_V3_TARGET_AUTHORITY_HASH_MISMATCH: authorityHash must bind the complete target authority projection",
    );
  });

export type StitchRenderedTargetAuthorityV3 = z.infer<
  typeof StitchRenderedTargetAuthorityV3Schema
>;

const SourceElementRefV3Schema = z.string().regex(/^S[0-9]{6}$/);

const StitchRenderedControlMappingPayloadV3Schema = z.object({
  controlSlotRef: ControlSlotIdSchema,
  actionRef: ActionIdSchema,
  elementRef: SourceElementRefV3Schema,
  sourceOrdinal: z.number().int().nonnegative().max(100_000),
  tagName: z.string().min(1).max(100),
  controlPlacementHash: Sha256Schema,
  actionHash: Sha256Schema,
}).strict();

export type StitchRenderedControlMappingPayloadV3 = z.infer<
  typeof StitchRenderedControlMappingPayloadV3Schema
>;

export function hashStitchRenderedControlMappingV3(
  value: StitchRenderedControlMappingPayloadV3,
): string {
  return hashCanonicalJson(StitchRenderedControlMappingPayloadV3Schema.parse(value));
}

export const StitchRenderedControlMappingV3Schema =
  StitchRenderedControlMappingPayloadV3Schema.extend({
    mappingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { mappingHash: _mappingHash, ...payload } = value;
    requireCanonicalHash(
      value.mappingHash,
      payload,
      context,
      ["mappingHash"],
      "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_HASH_MISMATCH",
    );
  });

const StitchRenderedActionInputMappingPayloadV3Schema = z.object({
  controlSlotRef: ControlSlotIdSchema,
  actionInputRef: z.string().min(3).max(500),
  actionRef: ActionIdSchema,
  elementRef: SourceElementRefV3Schema,
  sourceOrdinal: z.number().int().nonnegative().max(100_000),
  tagName: z.enum(["input", "textarea", "select"]),
  inputType: z.enum(["text", "number", "checkbox"]).nullable(),
  valueChannel: z.enum(["value", "checked"]),
  codecId: ActionInputCodecIdV2Schema,
  transportHash: Sha256Schema,
  matchedDomRequirementHash: Sha256Schema,
}).strict();

export type StitchRenderedActionInputMappingPayloadV3 = z.infer<
  typeof StitchRenderedActionInputMappingPayloadV3Schema
>;

export function hashStitchRenderedActionInputMappingV3(
  value: StitchRenderedActionInputMappingPayloadV3,
): string {
  return hashCanonicalJson(
    StitchRenderedActionInputMappingPayloadV3Schema.parse(value),
  );
}

export const StitchRenderedActionInputMappingV3Schema =
  StitchRenderedActionInputMappingPayloadV3Schema.extend({
    mappingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { mappingHash: _mappingHash, ...payload } = value;
    requireCanonicalHash(
      value.mappingHash,
      payload,
      context,
      ["mappingHash"],
      "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_HASH_MISMATCH",
    );
  });

const StitchRenderedSurfaceMappingPayloadV3Schema = z.object({
  surfaceRef: SurfaceIdSchema,
  ownership: z.enum(["route_root", "contained"]),
  elementRef: SourceElementRefV3Schema,
  sourceOrdinal: z.number().int().nonnegative().max(100_000),
  tagName: z.string().min(1).max(100),
  surfaceHash: Sha256Schema,
}).strict();

export type StitchRenderedSurfaceMappingPayloadV3 = z.infer<
  typeof StitchRenderedSurfaceMappingPayloadV3Schema
>;

export function hashStitchRenderedSurfaceMappingV3(
  value: StitchRenderedSurfaceMappingPayloadV3,
): string {
  return hashCanonicalJson(StitchRenderedSurfaceMappingPayloadV3Schema.parse(value));
}

export const StitchRenderedSurfaceMappingV3Schema =
  StitchRenderedSurfaceMappingPayloadV3Schema.extend({
    mappingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { mappingHash: _mappingHash, ...payload } = value;
    requireCanonicalHash(
      value.mappingHash,
      payload,
      context,
      ["mappingHash"],
      "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_HASH_MISMATCH",
    );
  });

const StitchRenderedObservableMappingPayloadV3Schema = z.object({
  observableRef: ObservableIdSchema,
  actionRef: ActionIdSchema,
  selectorKind: z.enum(["control", "surface", "accessibility"]),
  ownerKind: z.enum(["control", "surface"]),
  ownerRef: z.string().min(1).max(500),
  ownerElementRef: SourceElementRefV3Schema,
  selectorElementRef: SourceElementRefV3Schema.nullable(),
  accessibilityRole: z.string().min(1).max(100).nullable(),
  accessibilityName: z.string().min(1).max(500).nullable(),
  observableHash: Sha256Schema,
  selectorHash: Sha256Schema,
}).strict();

export type StitchRenderedObservableMappingPayloadV3 = z.infer<
  typeof StitchRenderedObservableMappingPayloadV3Schema
>;

export function hashStitchRenderedObservableMappingV3(
  value: StitchRenderedObservableMappingPayloadV3,
): string {
  return hashCanonicalJson(
    StitchRenderedObservableMappingPayloadV3Schema.parse(value),
  );
}

export const StitchRenderedObservableMappingV3Schema =
  StitchRenderedObservableMappingPayloadV3Schema.extend({
    mappingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const accessibility = value.selectorKind === "accessibility";
    const expectedOwnerKind = value.selectorKind === "control"
      ? "control"
      : "surface";
    if (value.ownerKind !== expectedOwnerKind) {
      context.addIssue({
        code: "custom",
        path: ["ownerKind"],
        message: "RENDERED_SEMANTICS_V3_OBSERVABLE_OWNER_KIND_MISMATCH",
      });
    }
    if (
      accessibility
        ? value.accessibilityRole === null
          || value.accessibilityName === null
          || value.selectorElementRef !== null
        : value.accessibilityRole !== null
          || value.accessibilityName !== null
          || value.selectorElementRef === null
          || value.selectorElementRef !== value.ownerElementRef
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectorElementRef"],
        message: "RENDERED_SEMANTICS_V3_OBSERVABLE_SELECTOR_PROJECTION_MISMATCH",
      });
    }
    const { mappingHash: _mappingHash, ...payload } = value;
    requireCanonicalHash(
      value.mappingHash,
      payload,
      context,
      ["mappingHash"],
      "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPING_HASH_MISMATCH",
    );
  });

export const StitchRenderedStaticFailurePhaseV3Schema = z.enum([
  "source_validation",
  "semantic_indexing",
  "surface_mapping",
  "control_mapping",
  "action_input_mapping",
  "observable_mapping",
]);

export type StitchRenderedStaticFailurePhaseV3 = z.infer<
  typeof StitchRenderedStaticFailurePhaseV3Schema
>;

export const StitchRenderedStaticFailureCodeV3Schema = z.enum([
  "RENDERED_SEMANTICS_V3_ARTIFACT_CAPACITY_EXCEEDED",
  "RENDERED_SEMANTICS_V3_HTML_ENCODING_INVALID",
  "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_INVALID",
  "RENDERED_SEMANTICS_V3_ELEMENT_CAPACITY_EXCEEDED",
  "RENDERED_SEMANTICS_V3_CONTRACT_ATTRIBUTE_DUPLICATE",
  "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_MISSING",
  "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_DUPLICATE",
  "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_EXTRA",
  "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_INVALID",
  "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_MISSING",
  "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_DUPLICATE",
  "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_EXTRA",
  "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_INVALID",
  "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_MISSING",
  "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_DUPLICATE",
  "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_EXTRA",
  "RENDERED_SEMANTICS_V3_ACTION_INPUT_MARKER_INVALID",
  "RENDERED_SEMANTICS_V3_ACTION_INPUT_CODEC_MISMATCH",
  "RENDERED_SEMANTICS_V3_ACTION_INPUT_DOM_INCOMPATIBLE",
  "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPING_UNRESOLVED",
]);

export type StitchRenderedStaticFailureCodeV3 = z.infer<
  typeof StitchRenderedStaticFailureCodeV3Schema
>;

const STITCH_RENDERED_STATIC_FAILURE_PHASE_BY_CODE_V3 = Object.freeze({
  RENDERED_SEMANTICS_V3_ARTIFACT_CAPACITY_EXCEEDED: "source_validation",
  RENDERED_SEMANTICS_V3_HTML_ENCODING_INVALID: "source_validation",
  RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_INVALID: "source_validation",
  RENDERED_SEMANTICS_V3_ELEMENT_CAPACITY_EXCEEDED: "semantic_indexing",
  RENDERED_SEMANTICS_V3_CONTRACT_ATTRIBUTE_DUPLICATE: "semantic_indexing",
  RENDERED_SEMANTICS_V3_SURFACE_MAPPING_MISSING: "surface_mapping",
  RENDERED_SEMANTICS_V3_SURFACE_MAPPING_DUPLICATE: "surface_mapping",
  RENDERED_SEMANTICS_V3_SURFACE_MAPPING_EXTRA: "surface_mapping",
  RENDERED_SEMANTICS_V3_SURFACE_MAPPING_INVALID: "surface_mapping",
  RENDERED_SEMANTICS_V3_CONTROL_MAPPING_MISSING: "control_mapping",
  RENDERED_SEMANTICS_V3_CONTROL_MAPPING_DUPLICATE: "control_mapping",
  RENDERED_SEMANTICS_V3_CONTROL_MAPPING_EXTRA: "control_mapping",
  RENDERED_SEMANTICS_V3_CONTROL_MAPPING_INVALID: "control_mapping",
  RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_MISSING: "action_input_mapping",
  RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_DUPLICATE: "action_input_mapping",
  RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_EXTRA: "action_input_mapping",
  RENDERED_SEMANTICS_V3_ACTION_INPUT_MARKER_INVALID: "action_input_mapping",
  RENDERED_SEMANTICS_V3_ACTION_INPUT_CODEC_MISMATCH: "action_input_mapping",
  RENDERED_SEMANTICS_V3_ACTION_INPUT_DOM_INCOMPATIBLE: "action_input_mapping",
  RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPING_UNRESOLVED: "observable_mapping",
} satisfies Readonly<Record<
  StitchRenderedStaticFailureCodeV3,
  StitchRenderedStaticFailurePhaseV3
>>);

export function stitchRenderedStaticFailurePhaseV3(
  code: StitchRenderedStaticFailureCodeV3,
): StitchRenderedStaticFailurePhaseV3 {
  return STITCH_RENDERED_STATIC_FAILURE_PHASE_BY_CODE_V3[code];
}

const StitchRenderedFailureSemanticRefV3Schema = z.object({
  kind: z.enum([
    "target",
    "surface",
    "control_slot",
    "action",
    "action_input",
    "observable",
    "contract_attribute",
  ]),
  ref: z.string().min(1).max(500),
}).strict();

const StitchRenderedFailureSourceRefV3Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("html_source"),
    ref: Sha256Schema,
  }).strict(),
  z.object({
    kind: z.literal("screenshot_source"),
    ref: Sha256Schema,
  }).strict(),
  z.object({
    kind: z.literal("source_element"),
    ref: SourceElementRefV3Schema,
  }).strict(),
]);

const StitchRenderedStaticFailureReceiptPayloadV3Schema = z.object({
  requestRef: DesignSourceGenerationRequestV3Schema.shape.requestRef,
  screenId: z.string().min(1).max(500),
  targetRef: GenerationTargetIdSchema,
  directCandidateHash: Sha256Schema,
  htmlArtifactHash: Sha256Schema,
  screenshotArtifactHash: Sha256Schema,
  phase: StitchRenderedStaticFailurePhaseV3Schema,
  code: StitchRenderedStaticFailureCodeV3Schema,
  semanticRefs: z.array(StitchRenderedFailureSemanticRefV3Schema).min(1).max(100),
  sourceElementRefCount: z.number().int().nonnegative().max(100_000),
  sourceElementRefsHash: Sha256Schema,
  sourceRefs: z.array(StitchRenderedFailureSourceRefV3Schema).min(2).max(
    STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3 + 2,
  ),
}).strict();

export type StitchRenderedStaticFailureReceiptPayloadV3 = z.infer<
  typeof StitchRenderedStaticFailureReceiptPayloadV3Schema
>;

export function hashStitchRenderedStaticFailureReceiptV3(
  value: StitchRenderedStaticFailureReceiptPayloadV3,
): string {
  return hashCanonicalJson(
    StitchRenderedStaticFailureReceiptPayloadV3Schema.parse(value),
  );
}

export const StitchRenderedStaticFailureReceiptV3Schema =
  StitchRenderedStaticFailureReceiptPayloadV3Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.phase !== stitchRenderedStaticFailurePhaseV3(value.code)) {
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "RENDERED_SEMANTICS_V3_STATIC_FAILURE_PHASE_MISMATCH",
      });
    }
    requireUniqueSorted(
      value.semanticRefs.map((entry) => `${entry.kind}\0${entry.ref}`),
      context,
      ["semanticRefs"],
      "Static failure semantic references",
    );
    requireUniqueSorted(
      value.sourceRefs.map((entry) => `${entry.kind}\0${entry.ref}`),
      context,
      ["sourceRefs"],
      "Static failure source references",
    );
    if (
      value.sourceRefs.filter((entry) => entry.kind === "html_source").length !== 1
      || value.sourceRefs.filter((entry) => entry.kind === "screenshot_source").length !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceRefs"],
        message: "RENDERED_SEMANTICS_V3_STATIC_FAILURE_SOURCE_AUTHORITY_CARDINALITY_MISMATCH",
      });
    }
    const sourceElementRefs = value.sourceRefs
      .filter((entry) => entry.kind === "source_element")
      .map((entry) => entry.ref);
    if (
      sourceElementRefs.length !== Math.min(
        value.sourceElementRefCount,
        STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceRefs"],
        message: "RENDERED_SEMANTICS_V3_STATIC_FAILURE_SOURCE_WITNESS_COUNT_MISMATCH",
      });
    }
    if (
      value.sourceElementRefCount
        <= STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3
      && value.sourceElementRefsHash !== hashCanonicalJson(sourceElementRefs)
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceElementRefsHash"],
        message: "RENDERED_SEMANTICS_V3_STATIC_FAILURE_SOURCE_REFS_HASH_MISMATCH",
      });
    }
    const { receiptHash: _receiptHash, ...payload } = value;
    requireCanonicalHash(
      value.receiptHash,
      payload,
      context,
      ["receiptHash"],
      "RENDERED_SEMANTICS_V3_STATIC_FAILURE_RECEIPT_HASH_MISMATCH",
    );
  });

export type StitchRenderedStaticFailureReceiptV3 = z.infer<
  typeof StitchRenderedStaticFailureReceiptV3Schema
>;

const StitchRenderedCandidateIdentityPayloadV3Schema = z.object({
  requestRef: DesignSourceGenerationRequestV3Schema.shape.requestRef,
  requestReceiptHash: Sha256Schema,
  dispatchReceiptHash: Sha256Schema,
  generationAuthorityHash: Sha256Schema,
  stageId: DesignSourceGenerationRequestV3Schema.shape.stageId,
  targetRef: GenerationTargetIdSchema,
  targetHash: Sha256Schema,
  requestScreenKey: z.string().min(1).max(500),
  screenId: z.string().min(1).max(500),
  title: z.string().min(1).max(500),
  rawTransportArtifactHash: Sha256Schema,
  providerResponseProjectionHash: Sha256Schema,
  directCandidateHash: Sha256Schema,
  sourceEvidenceHash: Sha256Schema,
  htmlSourceRefHash: Sha256Schema,
  screenshotSourceRefHash: Sha256Schema,
  htmlArtifactHash: Sha256Schema,
  screenshotArtifactHash: Sha256Schema,
  htmlByteLength: z.number().int().nonnegative().max(64 * 1024 * 1024),
  screenshotByteLength: z.number().int().nonnegative().max(128 * 1024 * 1024),
  targetAuthorityHash: Sha256Schema,
}).strict();

const StitchRenderedProjectedCandidatePayloadV3Schema =
  StitchRenderedCandidateIdentityPayloadV3Schema.extend({
  projectionStatus: z.literal("static_contract_projected"),
  surfaceMappings: z.array(StitchRenderedSurfaceMappingV3Schema).min(1).max(1_001),
  surfaceMappingsHash: Sha256Schema,
  controlMappings: z.array(StitchRenderedControlMappingV3Schema).max(2_000),
  controlMappingsHash: Sha256Schema,
  actionInputMappings: z.array(StitchRenderedActionInputMappingV3Schema).max(10_000),
  actionInputMappingsHash: Sha256Schema,
  observableMappings: z.array(StitchRenderedObservableMappingV3Schema).max(2_000),
  observableMappingsHash: Sha256Schema,
}).strict();

const StitchRenderedRejectedCandidatePayloadV3Schema =
  StitchRenderedCandidateIdentityPayloadV3Schema.extend({
    projectionStatus: z.literal("static_source_rejected"),
    failureReceipts: z.array(StitchRenderedStaticFailureReceiptV3Schema).min(1).max(100),
    failureReceiptsHash: Sha256Schema,
  }).strict();

const StitchRenderedCandidatePayloadV3Schema = z.discriminatedUnion(
  "projectionStatus",
  [
    StitchRenderedProjectedCandidatePayloadV3Schema,
    StitchRenderedRejectedCandidatePayloadV3Schema,
  ],
);

export type StitchRenderedCandidatePayloadV3 = z.infer<
  typeof StitchRenderedCandidatePayloadV3Schema
>;

export function hashStitchRenderedCandidateV3(
  value: StitchRenderedCandidatePayloadV3,
): string {
  return hashCanonicalJson(StitchRenderedCandidatePayloadV3Schema.parse(value));
}

const StitchRenderedProjectedCandidateV3Schema =
  StitchRenderedProjectedCandidatePayloadV3Schema.extend({
    candidateHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.htmlByteLength === 0
      || value.screenshotByteLength === 0
      || value.htmlByteLength > 8 * 1024 * 1024
      || value.screenshotByteLength > 16 * 1024 * 1024
    ) {
      context.addIssue({
        code: "custom",
        path: ["htmlByteLength"],
        message: "Projected candidate bytes exceed static projection capacity",
      });
    }
    requireUniqueSorted(
      value.surfaceMappings.map((entry) => entry.surfaceRef),
      context,
      ["surfaceMappings"],
      "Surface mappings",
    );
    if (!hasUniqueStrings(value.surfaceMappings.map((entry) => entry.elementRef))) {
      context.addIssue({
        code: "custom",
        path: ["surfaceMappings"],
        message: "RENDERED_SEMANTICS_V3_SURFACE_ELEMENT_OWNERSHIP_DUPLICATE",
      });
    }
    requireUniqueSorted(
      value.controlMappings.map((entry) => entry.controlSlotRef),
      context,
      ["controlMappings"],
      "Control mappings",
    );
    if (!hasUniqueStrings(value.controlMappings.map((entry) => entry.elementRef))) {
      context.addIssue({
        code: "custom",
        path: ["controlMappings"],
        message: "RENDERED_SEMANTICS_V3_CONTROL_ELEMENT_OWNERSHIP_DUPLICATE",
      });
    }
    requireUniqueSorted(
      value.actionInputMappings.map((entry) =>
        `${entry.controlSlotRef}\0${entry.actionInputRef}`),
      context,
      ["actionInputMappings"],
      "Action-input mappings",
    );
    if (!hasUniqueStrings(value.actionInputMappings.map((entry) => entry.elementRef))) {
      context.addIssue({
        code: "custom",
        path: ["actionInputMappings"],
        message: "RENDERED_SEMANTICS_V3_ACTION_INPUT_ELEMENT_OWNERSHIP_DUPLICATE",
      });
    }
    requireUniqueSorted(
      value.observableMappings.map((entry) => entry.observableRef),
      context,
      ["observableMappings"],
      "Observable mappings",
    );
    requireCanonicalHash(
      value.surfaceMappingsHash,
      value.surfaceMappings,
      context,
      ["surfaceMappingsHash"],
      "RENDERED_SEMANTICS_V3_SURFACE_MAPPINGS_HASH_MISMATCH",
    );
    requireCanonicalHash(
      value.controlMappingsHash,
      value.controlMappings,
      context,
      ["controlMappingsHash"],
      "RENDERED_SEMANTICS_V3_CONTROL_MAPPINGS_HASH_MISMATCH",
    );
    requireCanonicalHash(
      value.actionInputMappingsHash,
      value.actionInputMappings,
      context,
      ["actionInputMappingsHash"],
      "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPINGS_HASH_MISMATCH",
    );
    requireCanonicalHash(
      value.observableMappingsHash,
      value.observableMappings,
      context,
      ["observableMappingsHash"],
      "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPINGS_HASH_MISMATCH",
    );
    const { candidateHash: _candidateHash, ...payload } = value;
    requireCanonicalHash(
      value.candidateHash,
      payload,
      context,
      ["candidateHash"],
      "RENDERED_SEMANTICS_V3_CANDIDATE_HASH_MISMATCH",
    );
  });

const StitchRenderedRejectedCandidateV3Schema =
  StitchRenderedRejectedCandidatePayloadV3Schema.extend({
    candidateHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    requireUniqueSorted(
      value.failureReceipts.map((receipt) => receipt.receiptHash),
      context,
      ["failureReceipts"],
      "Static failure receipts",
    );
    value.failureReceipts.forEach((receipt, index) => {
      if (
        receipt.requestRef !== value.requestRef
        || receipt.screenId !== value.screenId
        || receipt.targetRef !== value.targetRef
        || receipt.directCandidateHash !== value.directCandidateHash
        || receipt.htmlArtifactHash !== value.htmlArtifactHash
        || receipt.screenshotArtifactHash !== value.screenshotArtifactHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["failureReceipts", index],
          message: "RENDERED_SEMANTICS_V3_STATIC_FAILURE_RECEIPT_IDENTITY_MISMATCH",
        });
      }
      if (
        !receipt.semanticRefs.some((reference) =>
          reference.kind === "target" && reference.ref === value.targetRef)
        || !receipt.sourceRefs.some((reference) =>
          reference.kind === "html_source" && reference.ref === value.htmlSourceRefHash)
        || !receipt.sourceRefs.some((reference) =>
          reference.kind === "screenshot_source"
          && reference.ref === value.screenshotSourceRefHash)
      ) {
        context.addIssue({
          code: "custom",
          path: ["failureReceipts", index],
          message: "RENDERED_SEMANTICS_V3_STATIC_FAILURE_RECEIPT_REFERENCE_MISMATCH",
        });
      }
    });
    requireCanonicalHash(
      value.failureReceiptsHash,
      value.failureReceipts,
      context,
      ["failureReceiptsHash"],
      "RENDERED_SEMANTICS_V3_STATIC_FAILURE_RECEIPTS_HASH_MISMATCH",
    );
    const { candidateHash: _candidateHash, ...payload } = value;
    requireCanonicalHash(
      value.candidateHash,
      payload,
      context,
      ["candidateHash"],
      "RENDERED_SEMANTICS_V3_CANDIDATE_HASH_MISMATCH",
    );
  });

export const StitchRenderedCandidateV3Schema = z.discriminatedUnion(
  "projectionStatus",
  [StitchRenderedProjectedCandidateV3Schema, StitchRenderedRejectedCandidateV3Schema],
);

export type StitchRenderedCandidateV3 = z.infer<
  typeof StitchRenderedCandidateV3Schema
>;

const StitchRenderedSemanticsPayloadV3Schema = z.object({
  schema: z.literal(STITCH_RENDERED_SEMANTICS_ARTIFACT_TYPE_V3),
  policy: z.literal(STITCH_RENDERED_SEMANTICS_POLICY_V3),
  generationTargetsPayloadHash: Sha256Schema,
  generationAuthorityHash: Sha256Schema,
  directResponseEvidencePayloadHash: Sha256Schema,
  verificationBoundary: StitchRenderedSemanticsVerificationBoundaryV3Schema,
  targetAuthorities: z.array(StitchRenderedTargetAuthorityV3Schema).min(1).max(1_000),
  targetAuthoritiesHash: Sha256Schema,
  candidates: z.array(StitchRenderedCandidateV3Schema).max(10_000),
  candidatesHash: Sha256Schema,
}).strict();

export type StitchRenderedSemanticsPayloadV3 = z.infer<
  typeof StitchRenderedSemanticsPayloadV3Schema
>;

export function hashStitchRenderedSemanticsV3(
  value: StitchRenderedSemanticsPayloadV3,
): string {
  return hashCanonicalJson(StitchRenderedSemanticsPayloadV3Schema.parse(value));
}

export const StitchRenderedSemanticsV3Schema =
  StitchRenderedSemanticsPayloadV3Schema.extend({
    payloadHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    requireUniqueSorted(
      value.targetAuthorities.map((authority) => authority.targetRef),
      context,
      ["targetAuthorities"],
      "Target authorities",
    );
    requireCanonicalHash(
      value.targetAuthoritiesHash,
      value.targetAuthorities,
      context,
      ["targetAuthoritiesHash"],
      "RENDERED_SEMANTICS_V3_TARGET_AUTHORITIES_HASH_MISMATCH",
    );
    const targetAuthorityByRef = new Map(value.targetAuthorities.map((authority) =>
      [authority.targetRef, authority] as const));
    const identities = value.candidates.map((candidate) =>
      `${candidate.requestRef}\0${candidate.screenId}`);
    requireUniqueSorted(
      identities,
      context,
      ["candidates"],
      "Rendered candidate composite identities",
    );
    value.candidates.forEach((candidate, index) => {
      if (candidate.generationAuthorityHash !== value.generationAuthorityHash) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "generationAuthorityHash"],
          message: "RENDERED_SEMANTICS_V3_GENERATION_AUTHORITY_MISMATCH",
        });
      }
      const authority = targetAuthorityByRef.get(candidate.targetRef);
      if (
        !authority
        || authority.targetHash !== candidate.targetHash
        || authority.authorityHash !== candidate.targetAuthorityHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "targetAuthorityHash"],
          message: "RENDERED_SEMANTICS_V3_TARGET_AUTHORITY_REFERENCE_MISMATCH",
        });
        return;
      }
      if (candidate.projectionStatus !== "static_contract_projected") return;
      const surfaceAuthorityByRef = new Map(authority.surfaces.map((entry) =>
        [entry.surfaceRef, entry] as const));
      if (
        candidate.surfaceMappings.length !== authority.surfaces.length
        || candidate.surfaceMappings.some((mapping) => {
          const surface = surfaceAuthorityByRef.get(mapping.surfaceRef);
          return !surface
            || surface.ownership !== mapping.ownership
            || surface.surfaceHash !== mapping.surfaceHash;
        })
      ) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "surfaceMappings"],
          message: "RENDERED_SEMANTICS_V3_SURFACE_AUTHORITY_CLOSURE_MISMATCH",
        });
      }
      const controlAuthorityByRef = new Map(authority.controls.map((entry) =>
        [entry.controlSlotRef, entry] as const));
      const actionAuthorityByRef = new Map(authority.actions.map((entry) =>
        [entry.actionRef, entry] as const));
      if (
        candidate.controlMappings.length !== authority.controls.length
        || candidate.controlMappings.some((mapping) => {
          const control = controlAuthorityByRef.get(mapping.controlSlotRef);
          const action = actionAuthorityByRef.get(mapping.actionRef);
          return !control
            || control.actionRef !== mapping.actionRef
            || control.controlPlacementHash !== mapping.controlPlacementHash
            || action?.actionHash !== mapping.actionHash;
        })
      ) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "controlMappings"],
          message: "RENDERED_SEMANTICS_V3_CONTROL_AUTHORITY_CLOSURE_MISMATCH",
        });
      }
      const inputAuthorityByRef = new Map(authority.actionInputTransports.map((entry) =>
        [`${entry.controlSlotRef}\0${entry.actionInputRef}`, entry] as const));
      if (
        candidate.actionInputMappings.length !== authority.actionInputTransports.length
        || candidate.actionInputMappings.some((mapping) =>
          inputAuthorityByRef.get(
            `${mapping.controlSlotRef}\0${mapping.actionInputRef}`,
          )?.transportHash !== mapping.transportHash)
      ) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "actionInputMappings"],
          message: "RENDERED_SEMANTICS_V3_ACTION_INPUT_AUTHORITY_CLOSURE_MISMATCH",
        });
      }
      const observableAuthorityByRef = new Map(authority.observables.map((entry) =>
        [entry.observableRef, entry] as const));
      if (
        candidate.observableMappings.length !== authority.observables.length
        || candidate.observableMappings.some((mapping) => {
          const observable = observableAuthorityByRef.get(mapping.observableRef);
          return !observable
            || observable.actionRef !== mapping.actionRef
            || observable.observableHash !== mapping.observableHash
            || observable.selectorHash !== mapping.selectorHash;
        })
      ) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "observableMappings"],
          message: "RENDERED_SEMANTICS_V3_OBSERVABLE_AUTHORITY_CLOSURE_MISMATCH",
        });
      }
    });
    requireCanonicalHash(
      value.candidatesHash,
      value.candidates,
      context,
      ["candidatesHash"],
      "RENDERED_SEMANTICS_V3_CANDIDATES_HASH_MISMATCH",
    );
    const { payloadHash: _payloadHash, ...payload } = value;
    requireCanonicalHash(
      value.payloadHash,
      payload,
      context,
      ["payloadHash"],
      "RENDERED_SEMANTICS_V3_PAYLOAD_HASH_MISMATCH",
    );
  });

export type StitchRenderedSemanticsV3 = z.infer<
  typeof StitchRenderedSemanticsV3Schema
>;

export type StitchRenderedSemanticsParseResultV3 =
  | Readonly<{
      status: "parsed";
      renderedSemantics: StitchRenderedSemanticsV3;
    }>
  | Readonly<{
      status: "rejected";
      issuePath: string;
      issueMessage: string;
    }>;

/**
 * Total boundary for unknown/in-process input. Raw Zod schemas remain useful
 * for ordinary deserialized values, but Zod property discovery can execute a
 * hostile Proxy trap before `safeParse` returns. Operational consumers must
 * use this boundary so such traps become typed rejection rather than escape.
 */
export function parseStitchRenderedSemanticsV3(
  input: unknown,
): StitchRenderedSemanticsParseResultV3 {
  try {
    const parsed = StitchRenderedSemanticsV3Schema.safeParse(input);
    if (parsed.success) {
      return { status: "parsed", renderedSemantics: parsed.data };
    }
    const issue = parsed.error.issues[0];
    return {
      status: "rejected",
      issuePath: issue?.path.map(String).join("/") || "$",
      issueMessage: issue?.message.slice(0, 500) || "schema mismatch",
    };
  } catch {
    return {
      status: "rejected",
      issuePath: "$",
      issueMessage: "hostile or inaccessible input",
    };
  }
}
