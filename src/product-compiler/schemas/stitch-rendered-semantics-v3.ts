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
    for (const [path, actual, expected] of [
      ["surfacesHash", value.surfacesHash, hashCanonicalJson(value.surfaces)],
      ["controlsHash", value.controlsHash, hashCanonicalJson(value.controls)],
      ["actionsHash", value.actionsHash, hashCanonicalJson(value.actions)],
      [
        "evidencePredicatesHash",
        value.evidencePredicatesHash,
        hashCanonicalJson(value.evidencePredicates),
      ],
      ["observablesHash", value.observablesHash, hashCanonicalJson(value.observables)],
      [
        "actionInputTransportsHash",
        value.actionInputTransportsHash,
        hashCanonicalJson(value.actionInputTransports),
      ],
    ] as const) {
      if (actual !== expected) {
        context.addIssue({
          code: "custom",
          path: [path],
          message: `${path} must bind its exact ordered target authority projection`,
        });
      }
    }
    const { authorityHash: _authorityHash, ...payload } = value;
    if (value.authorityHash !== hashStitchRenderedTargetAuthorityV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["authorityHash"],
        message: "RENDERED_SEMANTICS_V3_TARGET_AUTHORITY_HASH_MISMATCH: authorityHash must bind the complete target authority projection",
      });
    }
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
    if (value.mappingHash !== hashStitchRenderedControlMappingV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["mappingHash"],
        message: "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_HASH_MISMATCH",
      });
    }
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
    if (value.mappingHash !== hashStitchRenderedActionInputMappingV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["mappingHash"],
        message: "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_HASH_MISMATCH",
      });
    }
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
    if (value.mappingHash !== hashStitchRenderedSurfaceMappingV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["mappingHash"],
        message: "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_HASH_MISMATCH",
      });
    }
  });

const StitchRenderedObservableMappingPayloadV3Schema = z.object({
  observableRef: ObservableIdSchema,
  actionRef: ActionIdSchema,
  selectorKind: z.enum(["control", "surface", "accessibility"]),
  ownerKind: z.enum(["control", "surface"]),
  ownerRef: z.string().min(1).max(500),
  ownerElementRef: SourceElementRefV3Schema,
  selectorElementRef: SourceElementRefV3Schema,
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
        ? value.accessibilityRole === null || value.accessibilityName === null
        : value.accessibilityRole !== null
          || value.accessibilityName !== null
          || value.selectorElementRef !== value.ownerElementRef
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectorElementRef"],
        message: "RENDERED_SEMANTICS_V3_OBSERVABLE_SELECTOR_PROJECTION_MISMATCH",
      });
    }
    const { mappingHash: _mappingHash, ...payload } = value;
    if (value.mappingHash !== hashStitchRenderedObservableMappingV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["mappingHash"],
        message: "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPING_HASH_MISMATCH",
      });
    }
  });

const StitchRenderedCandidatePayloadV3Schema = z.object({
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
  htmlByteLength: z.number().int().positive().max(8 * 1024 * 1024),
  screenshotByteLength: z.number().int().positive().max(16 * 1024 * 1024),
  projectionStatus: z.literal("static_contract_projected"),
  targetAuthorityHash: Sha256Schema,
  surfaceMappings: z.array(StitchRenderedSurfaceMappingV3Schema).min(1).max(1_001),
  surfaceMappingsHash: Sha256Schema,
  controlMappings: z.array(StitchRenderedControlMappingV3Schema).max(2_000),
  controlMappingsHash: Sha256Schema,
  actionInputMappings: z.array(StitchRenderedActionInputMappingV3Schema).max(10_000),
  actionInputMappingsHash: Sha256Schema,
  observableMappings: z.array(StitchRenderedObservableMappingV3Schema).max(2_000),
  observableMappingsHash: Sha256Schema,
}).strict();

export type StitchRenderedCandidatePayloadV3 = z.infer<
  typeof StitchRenderedCandidatePayloadV3Schema
>;

export function hashStitchRenderedCandidateV3(
  value: StitchRenderedCandidatePayloadV3,
): string {
  return hashCanonicalJson(StitchRenderedCandidatePayloadV3Schema.parse(value));
}

export const StitchRenderedCandidateV3Schema =
  StitchRenderedCandidatePayloadV3Schema.extend({
    candidateHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
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
    if (value.surfaceMappingsHash !== hashCanonicalJson(value.surfaceMappings)) {
      context.addIssue({
        code: "custom",
        path: ["surfaceMappingsHash"],
        message: "RENDERED_SEMANTICS_V3_SURFACE_MAPPINGS_HASH_MISMATCH",
      });
    }
    if (value.controlMappingsHash !== hashCanonicalJson(value.controlMappings)) {
      context.addIssue({
        code: "custom",
        path: ["controlMappingsHash"],
        message: "RENDERED_SEMANTICS_V3_CONTROL_MAPPINGS_HASH_MISMATCH",
      });
    }
    if (
      value.actionInputMappingsHash
      !== hashCanonicalJson(value.actionInputMappings)
    ) {
      context.addIssue({
        code: "custom",
        path: ["actionInputMappingsHash"],
        message: "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPINGS_HASH_MISMATCH",
      });
    }
    if (value.observableMappingsHash !== hashCanonicalJson(value.observableMappings)) {
      context.addIssue({
        code: "custom",
        path: ["observableMappingsHash"],
        message: "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPINGS_HASH_MISMATCH",
      });
    }
    const { candidateHash: _candidateHash, ...payload } = value;
    if (value.candidateHash !== hashStitchRenderedCandidateV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["candidateHash"],
        message: "RENDERED_SEMANTICS_V3_CANDIDATE_HASH_MISMATCH",
      });
    }
  });

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
  candidates: z.array(StitchRenderedCandidateV3Schema).min(1).max(10_000),
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
    if (value.targetAuthoritiesHash !== hashCanonicalJson(value.targetAuthorities)) {
      context.addIssue({
        code: "custom",
        path: ["targetAuthoritiesHash"],
        message: "RENDERED_SEMANTICS_V3_TARGET_AUTHORITIES_HASH_MISMATCH",
      });
    }
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
    if (value.candidatesHash !== hashCanonicalJson(value.candidates)) {
      context.addIssue({
        code: "custom",
        path: ["candidatesHash"],
        message: "RENDERED_SEMANTICS_V3_CANDIDATES_HASH_MISMATCH",
      });
    }
    const { payloadHash: _payloadHash, ...payload } = value;
    if (value.payloadHash !== hashStitchRenderedSemanticsV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["payloadHash"],
        message: "RENDERED_SEMANTICS_V3_PAYLOAD_HASH_MISMATCH",
      });
    }
  });

export type StitchRenderedSemanticsV3 = z.infer<
  typeof StitchRenderedSemanticsV3Schema
>;
