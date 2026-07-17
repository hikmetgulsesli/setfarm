import { createHash } from "node:crypto";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import { isValidStitchHtmlBytes, isValidStitchScreenshotBytes } from "../stitch-render-artifact.js";
import {
  isNativeStitchActionElementV1,
  parseStitchSemanticDomV1,
  stitchSemanticAttribute,
  type StitchSemanticElementV1,
} from "../stitch-semantic-dom-v1.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  checkActionInputDomCompatibilityV2,
  type ActionInputTransportV2,
} from "../schemas/action-input-transport-v2.js";
import {
  DesignGenerationTargetsV3Schema,
  type DesignGenerationTargetV3,
} from "../schemas/design-generation-targets-v3.js";
import { DesignSourceGenerationAuthorityV1Schema } from "../schemas/design-source-generation-authority-v1.js";
import { DesignSourceGenerationRequestV3Schema } from "../schemas/design-source-generation-request-v3.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";
import {
  STITCH_RENDERED_SEMANTICS_ARTIFACT_TYPE_V3,
  STITCH_RENDERED_SEMANTICS_POLICY_V3,
  StitchRenderedSemanticsV3Schema,
  StitchRenderedTargetAuthorityV3Schema,
  hashStitchRenderedActionInputMappingV3,
  hashStitchRenderedCandidateV3,
  hashStitchRenderedControlMappingV3,
  hashStitchRenderedObservableMappingV3,
  hashStitchRenderedSemanticsV3,
  hashStitchRenderedSurfaceMappingV3,
  hashStitchRenderedTargetAuthorityV3,
  type StitchRenderedActionInputMappingPayloadV3,
  type StitchRenderedCandidateV3,
  type StitchRenderedControlMappingPayloadV3,
  type StitchRenderedObservableMappingPayloadV3,
  type StitchRenderedSemanticsV3,
  type StitchRenderedSurfaceMappingPayloadV3,
  type StitchRenderedTargetAuthorityV3,
} from "../schemas/stitch-rendered-semantics-v3.js";
import {
  verifyStitchDirectResponseEvidenceV3,
  type BoundStitchDirectProviderResponseV3,
} from "./stitch-direct-response-v3.js";

const CONTRACT_ATTRIBUTES_V3 = new Set([
  "data-action",
  "data-control-slot",
  "data-action-input",
  "data-action-input-slot",
  "data-action-input-codec",
  "data-action-input-enum-options",
  "data-surface-id",
  "role",
  "aria-label",
]);

const MAX_HTML_BYTES_V3 = 8 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES_V3 = 16 * 1024 * 1024;
const MAX_TOTAL_HTML_BYTES_V3 = 64 * 1024 * 1024;
const MAX_TOTAL_SCREENSHOT_BYTES_V3 = 128 * 1024 * 1024;
const MAX_SEMANTIC_ELEMENTS_V3 = 100_000;
const ARTIFACT_KEYS_V3 = new Set([
  "requestRef",
  "screenId",
  "htmlBytes",
  "screenshotBytes",
]);
const ScreenIdV3Schema = z.string().min(1).max(500);

export type StitchRenderedCandidateArtifactBytesV3 = Readonly<{
  requestRef: string;
  screenId: string;
  htmlBytes?: Uint8Array;
  screenshotBytes?: Uint8Array;
}>;

export type StitchRenderedSemanticsDiagnosticCodeV3 =
  | "RENDERED_SEMANTICS_V3_DIRECT_RESPONSE_INVALID"
  | "RENDERED_SEMANTICS_V3_NO_ADMITTED_CANDIDATE"
  | "RENDERED_SEMANTICS_V3_TARGET_ADMISSION_INCOMPLETE"
  | "RENDERED_SEMANTICS_V3_ARTIFACT_SET_INVALID"
  | "RENDERED_SEMANTICS_V3_ARTIFACT_WORK_CAPACITY_EXCEEDED"
  | "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_MISSING"
  | "RENDERED_SEMANTICS_V3_ARTIFACT_CAPACITY_EXCEEDED"
  | "RENDERED_SEMANTICS_V3_HTML_ENCODING_INVALID"
  | "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_INVALID"
  | "RENDERED_SEMANTICS_V3_ARTIFACT_HASH_MISMATCH"
  | "RENDERED_SEMANTICS_V3_TARGET_UNRESOLVED"
  | "RENDERED_SEMANTICS_V3_ELEMENT_CAPACITY_EXCEEDED"
  | "RENDERED_SEMANTICS_V3_CONTRACT_ATTRIBUTE_DUPLICATE"
  | "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_MISSING"
  | "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_DUPLICATE"
  | "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_EXTRA"
  | "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_INVALID"
  | "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_MISSING"
  | "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_DUPLICATE"
  | "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_EXTRA"
  | "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_INVALID"
  | "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_MISSING"
  | "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_DUPLICATE"
  | "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_EXTRA"
  | "RENDERED_SEMANTICS_V3_ACTION_INPUT_MARKER_INVALID"
  | "RENDERED_SEMANTICS_V3_ACTION_INPUT_CODEC_MISMATCH"
  | "RENDERED_SEMANTICS_V3_ACTION_INPUT_DOM_INCOMPATIBLE"
  | "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPING_UNRESOLVED"
  | "RENDERED_SEMANTICS_V3_ACCESSIBILITY_MAPPING_MISSING"
  | "RENDERED_SEMANTICS_V3_ACCESSIBILITY_MAPPING_DUPLICATE"
  | "RENDERED_SEMANTICS_V3_OUTPUT_INVALID"
  | "RENDERED_SEMANTICS_V3_REPRODUCTION_INPUT_INVALID"
  | "RENDERED_SEMANTICS_V3_AUTHORITY_MISMATCH";

type Rejected = Readonly<{
  status: "rejected";
  rejectionCodes: StitchRenderedSemanticsDiagnosticCodeV3[];
  diagnostics: CompilationDiagnosticV1[];
}>;

export type StitchRenderedSemanticsProductionResultV3 =
  | Readonly<{
      status: "produced_unverified_browser_cas";
      renderedSemantics: StitchRenderedSemanticsV3;
      diagnostics: readonly [];
    }>
  | Rejected;

export type StitchRenderedSemanticsReproductionResultV3 =
  | Readonly<{
      status: "reproduced_unverified_browser_cas";
      renderedSemantics: StitchRenderedSemanticsV3;
      diagnostics: readonly [];
    }>
  | Rejected;

type CommonInputV3 = Readonly<{
  productSpec: unknown;
  generationTargets: unknown;
  generationAuthority: unknown;
  requests: readonly unknown[];
  dispatchReceipts: readonly unknown[];
  rawResponses: readonly BoundStitchDirectProviderResponseV3[];
  directResponseEvidence: unknown;
  artifacts: readonly StitchRenderedCandidateArtifactBytesV3[];
}>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function diagnostic(
  code: StitchRenderedSemanticsDiagnosticCodeV3,
  message: string,
  reference?: string,
): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code,
    category: "execution_identity",
    severity: "error",
    message: message.slice(0, 2_000),
    ...(reference ? { reference: reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(...input: CompilationDiagnosticV1[]): Rejected {
  const diagnostics = sortCompilationDiagnostics(input);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(diagnostics.map((entry) =>
      entry.code as StitchRenderedSemanticsDiagnosticCodeV3)),
    diagnostics,
  };
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return `${issue?.path.join("/") || "$"}: ${issue?.message || "schema mismatch"}`;
}

function compositeKey(requestRef: string, screenId: string): string {
  return `${requestRef}\0${screenId}`;
}

function isCandidateArtifactBytesV3(
  value: unknown,
): value is StitchRenderedCandidateArtifactBytesV3 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ARTIFACT_KEYS_V3.has(key))) return false;
  if (!DesignSourceGenerationRequestV3Schema.shape.requestRef.safeParse(
    record.requestRef,
  ).success) return false;
  if (!ScreenIdV3Schema.safeParse(record.screenId).success) return false;
  return (record.htmlBytes === undefined || record.htmlBytes instanceof Uint8Array)
    && (record.screenshotBytes === undefined
      || record.screenshotBytes instanceof Uint8Array);
}

function artifactWorkWithinCapacityV3(
  artifacts: readonly StitchRenderedCandidateArtifactBytesV3[],
): boolean {
  let htmlBytes = 0;
  let screenshotBytes = 0;
  for (const artifact of artifacts) {
    htmlBytes += artifact.htmlBytes?.byteLength ?? 0;
    screenshotBytes += artifact.screenshotBytes?.byteLength ?? 0;
    if (
      htmlBytes > MAX_TOTAL_HTML_BYTES_V3
      || screenshotBytes > MAX_TOTAL_SCREENSHOT_BYTES_V3
    ) return false;
  }
  return true;
}

function targetAuthority(
  productSpec: ProductSpecV2,
  target: DesignGenerationTargetV3,
): StitchRenderedTargetAuthorityV3 {
  const route = productSpec.routes.find((candidate) => candidate.id === target.routeRef);
  if (!route || route.rootSurfaceRef !== target.surfaceRef) {
    throw new Error(`Unresolved target route/root ${target.routeRef}/${target.surfaceRef}`);
  }
  const surfaceByRef = new Map(productSpec.surfaces.map((surface) =>
    [surface.id, surface] as const));
  const surfaceRefs = [target.surfaceRef, ...target.containedSurfaceRefs]
    .sort(compareUtf16);
  const surfaces = surfaceRefs.map((surfaceRef) => {
    const surface = surfaceByRef.get(surfaceRef);
    if (!surface) throw new Error(`Unresolved target surface ${surfaceRef}`);
    return {
      surfaceRef,
      ownership: surfaceRef === target.surfaceRef
        ? "route_root" as const
        : "contained" as const,
      surfaceHash: hashCanonicalJson(surface),
    };
  });
  const actionByRef = new Map(target.requiredActions.map((action) =>
    [action.id, action] as const));
  const controls = target.requiredControlPlacements.map((placement) => ({
    controlSlotRef: placement.controlSlotRef,
    actionRef: placement.actionRef,
    controlPlacementHash: hashCanonicalJson(placement),
    actionInputTransportsHash: placement.actionInputTransportsHash,
  })).sort((left, right) => compareUtf16(left.controlSlotRef, right.controlSlotRef));
  const actions = target.requiredActions.map((action) => ({
    actionRef: action.id,
    actionHash: hashCanonicalJson(action),
  })).sort((left, right) => compareUtf16(left.actionRef, right.actionRef));
  const evidencePredicates = target.requiredEvidencePredicates.map((evidence) => ({
    evidenceRef: evidence.id,
    evidenceHash: hashCanonicalJson(evidence),
  })).sort((left, right) => compareUtf16(left.evidenceRef, right.evidenceRef));
  const observables = target.requiredObservableSelectors.map((observable) => ({
    observableRef: observable.observableRef,
    actionRef: observable.actionRef,
    observableHash: hashCanonicalJson(observable),
    selectorHash: hashCanonicalJson(observable.selector),
  })).sort((left, right) => compareUtf16(left.observableRef, right.observableRef));
  const actionInputTransports = target.requiredControlPlacements.flatMap((placement) =>
    placement.actionInputTransports.map((transport) => ({
      controlSlotRef: placement.controlSlotRef,
      actionInputRef: transport.actionInputRef,
      transportHash: transport.contractHash,
    }))).sort((left, right) => compareUtf16(
    `${left.controlSlotRef}\0${left.actionInputRef}`,
    `${right.controlSlotRef}\0${right.actionInputRef}`,
  ));
  for (const control of controls) {
    if (!actionByRef.has(control.actionRef)) {
      throw new Error(`Unresolved control action ${control.actionRef}`);
    }
  }
  const payload = {
    targetRef: target.targetId,
    targetHash: target.targetHash,
    routeRef: target.routeRef,
    routeHash: hashCanonicalJson(route),
    rootSurfaceRef: target.surfaceRef,
    containedSurfaceRefs: [...target.containedSurfaceRefs],
    surfaces,
    surfacesHash: hashCanonicalJson(surfaces),
    controls,
    controlsHash: hashCanonicalJson(controls),
    actions,
    actionsHash: hashCanonicalJson(actions),
    evidencePredicates,
    evidencePredicatesHash: hashCanonicalJson(evidencePredicates),
    observables,
    observablesHash: hashCanonicalJson(observables),
    actionInputTransports,
    actionInputTransportsHash: hashCanonicalJson(actionInputTransports),
  };
  return StitchRenderedTargetAuthorityV3Schema.parse({
    ...payload,
    authorityHash: hashStitchRenderedTargetAuthorityV3(payload),
  });
}

type IndexedElement = Readonly<{
  element: StitchSemanticElementV1;
  elementRef: string;
  sourceOrdinal: number;
}>;

function indexedElements(html: string): IndexedElement[] | Rejected {
  const elements = parseStitchSemanticDomV1(html);
  if (elements.length > MAX_SEMANTIC_ELEMENTS_V3) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ELEMENT_CAPACITY_EXCEEDED",
      `Rendered HTML contains ${elements.length} semantic elements; maximum is ${MAX_SEMANTIC_ELEMENTS_V3}`,
      "htmlBytes",
    ));
  }
  const duplicate = elements.flatMap((element) =>
    element.duplicateAttributes.filter((attribute) =>
      CONTRACT_ATTRIBUTES_V3.has(attribute)));
  if (duplicate.length > 0) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_CONTRACT_ATTRIBUTE_DUPLICATE",
      `Contract attributes must occur at most once per element: ${uniqueSorted(duplicate).join(",")}`,
      duplicate[0],
    ));
  }
  return elements.map((element, sourceOrdinal) => ({
    element,
    elementRef: `S${String(sourceOrdinal + 1).padStart(6, "0")}`,
    sourceOrdinal,
  }));
}

function decodeExactUtf8(htmlBytes: Uint8Array): string | Rejected {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(htmlBytes);
    const roundTrip = Buffer.from(decoded, "utf8");
    const original = Buffer.from(
      htmlBytes.buffer,
      htmlBytes.byteOffset,
      htmlBytes.byteLength,
    );
    if (!roundTrip.equals(original)) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_HTML_ENCODING_INVALID",
        "Rendered HTML must be canonical UTF-8 whose decoded text round-trips to the exact input bytes",
        "htmlBytes",
      ));
    }
    return decoded;
  } catch {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_HTML_ENCODING_INVALID",
      "Rendered HTML contains a fatal UTF-8 decoding error",
      "htmlBytes",
    ));
  }
}

function actionHash(target: DesignGenerationTargetV3, actionRef: string): string {
  const action = target.requiredActions.find((candidate) => candidate.id === actionRef);
  if (!action) throw new Error(`Unresolved target action ${actionRef}`);
  return hashCanonicalJson(action);
}

function compileSurfaceMappings(
  authority: StitchRenderedTargetAuthorityV3,
  elements: readonly IndexedElement[],
): StitchRenderedSurfaceMappingPayloadV3[] | Rejected {
  const expectedByRef = new Map(authority.surfaces.map((surface) =>
    [surface.surfaceRef, surface] as const));
  const marked = elements.filter(({ element }) =>
    stitchSemanticAttribute(element, "data-surface-id") !== undefined);
  for (const entry of marked) {
    const surfaceRef = stitchSemanticAttribute(entry.element, "data-surface-id");
    if (!surfaceRef || !expectedByRef.has(surfaceRef)) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_EXTRA",
        "Every rendered surface marker must identify one exact target surface",
        surfaceRef || entry.elementRef,
      ));
    }
  }

  const mappings: StitchRenderedSurfaceMappingPayloadV3[] = [];
  for (const surface of authority.surfaces) {
    const matches = marked.filter(({ element }) =>
      stitchSemanticAttribute(element, "data-surface-id") === surface.surfaceRef);
    if (matches.length === 0) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_MISSING",
        `Required surface ${surface.surfaceRef} has no exact DOM mapping`,
        surface.surfaceRef,
      ));
    }
    if (matches.length !== 1) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_DUPLICATE",
        `Required surface ${surface.surfaceRef} has ${matches.length} DOM mappings`,
        surface.surfaceRef,
      ));
    }
    const match = matches[0]!;
    if (
      !match.element.rendered
      || match.element.activeSurfaceRef !== surface.surfaceRef
    ) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_INVALID",
        `Surface ${surface.surfaceRef} must be an exact rendered DOM owner`,
        surface.surfaceRef,
      ));
    }
    mappings.push({
      surfaceRef: surface.surfaceRef,
      ownership: surface.ownership,
      elementRef: match.elementRef,
      sourceOrdinal: match.sourceOrdinal,
      tagName: match.element.tagName,
      surfaceHash: surface.surfaceHash,
    });
  }
  return mappings.sort((left, right) => compareUtf16(left.surfaceRef, right.surfaceRef));
}

function compileControlMappings(
  target: DesignGenerationTargetV3,
  elements: readonly IndexedElement[],
): StitchRenderedControlMappingPayloadV3[] | Rejected {
  const expectedBySlot = new Map(target.requiredControlPlacements.map((placement) =>
    [placement.controlSlotRef, placement] as const));
  const marked = elements.filter(({ element }) =>
    stitchSemanticAttribute(element, "data-control-slot") !== undefined
    || stitchSemanticAttribute(element, "data-action") !== undefined);
  for (const entry of marked) {
    const slotRef = stitchSemanticAttribute(entry.element, "data-control-slot");
    const actionRef = stitchSemanticAttribute(entry.element, "data-action");
    if (!slotRef || !actionRef || !expectedBySlot.has(slotRef)) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_EXTRA",
        "Every action/control marker must identify one required target control tuple",
        slotRef ?? actionRef ?? entry.elementRef,
      ));
    }
  }

  const mappings: StitchRenderedControlMappingPayloadV3[] = [];
  for (const placement of target.requiredControlPlacements) {
    const matches = marked.filter(({ element }) =>
      stitchSemanticAttribute(element, "data-control-slot") === placement.controlSlotRef
      && stitchSemanticAttribute(element, "data-action") === placement.actionRef);
    if (matches.length === 0) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_MISSING",
        `Required control ${placement.controlSlotRef}/${placement.actionRef} has no exact DOM mapping`,
        placement.controlSlotRef,
      ));
    }
    if (matches.length !== 1) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_DUPLICATE",
        `Required control ${placement.controlSlotRef}/${placement.actionRef} has ${matches.length} DOM mappings`,
        placement.controlSlotRef,
      ));
    }
    const match = matches[0]!;
    if (
      !isNativeStitchActionElementV1(match.element)
      || match.element.activeSurfaceRef !== placement.surfaceRef
    ) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_INVALID",
        `Control ${placement.controlSlotRef} must be an enabled native action element on ${placement.surfaceRef}`,
        placement.controlSlotRef,
      ));
    }
    mappings.push({
      controlSlotRef: placement.controlSlotRef,
      actionRef: placement.actionRef,
      elementRef: match.elementRef,
      sourceOrdinal: match.sourceOrdinal,
      tagName: match.element.tagName,
      controlPlacementHash: hashCanonicalJson(placement),
      actionHash: actionHash(target, placement.actionRef),
    });
  }
  return mappings.sort((left, right) =>
    compareUtf16(left.controlSlotRef, right.controlSlotRef));
}

function enumOptions(element: StitchSemanticElementV1): string[] | null | undefined {
  const marker = stitchSemanticAttribute(element, "data-action-input-enum-options");
  if (marker === undefined) return null;
  try {
    const parsed = JSON.parse(marker);
    return Array.isArray(parsed) && parsed.every((value) => typeof value === "string")
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function domCandidate(element: StitchSemanticElementV1) {
  const inputType = element.tagName === "input"
    ? (stitchSemanticAttribute(element, "type") ?? "text").toLowerCase()
    : null;
  return {
    tagName: element.tagName,
    inputType,
    valueChannel: inputType === "checkbox" ? "checked" as const : "value" as const,
    codecMarker: stitchSemanticAttribute(element, "data-action-input-codec") ?? null,
    enumOptions: enumOptions(element),
  };
}

function expectedInputTuples(target: DesignGenerationTargetV3): Array<Readonly<{
  placement: DesignGenerationTargetV3["requiredControlPlacements"][number];
  transport: ActionInputTransportV2;
}>> {
  return target.requiredControlPlacements.flatMap((placement) =>
    placement.actionInputTransports.map((transport) => ({ placement, transport })))
    .sort((left, right) => compareUtf16(
      `${left.placement.controlSlotRef}\0${left.transport.actionInputRef}`,
      `${right.placement.controlSlotRef}\0${right.transport.actionInputRef}`,
    ));
}

function compileActionInputMappings(
  target: DesignGenerationTargetV3,
  elements: readonly IndexedElement[],
): StitchRenderedActionInputMappingPayloadV3[] | Rejected {
  const expected = expectedInputTuples(target);
  const expectedKeys = new Set(expected.map(({ placement, transport }) =>
    compositeKey(placement.controlSlotRef, transport.actionInputRef)));
  const marked = elements.filter(({ element }) => [
    "data-action-input-slot",
    "data-action-input",
    "data-action-input-codec",
    "data-action-input-enum-options",
  ].some((attribute) => stitchSemanticAttribute(element, attribute) !== undefined));

  for (const entry of marked) {
    const slotRef = stitchSemanticAttribute(entry.element, "data-action-input-slot");
    const actionInputRef = stitchSemanticAttribute(entry.element, "data-action-input");
    const codec = stitchSemanticAttribute(entry.element, "data-action-input-codec");
    if (!slotRef || !actionInputRef || !codec) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_MARKER_INVALID",
        "Action-input elements require data-action-input-slot, data-action-input, and data-action-input-codec together",
        entry.elementRef,
      ));
    }
    if (!expectedKeys.has(compositeKey(slotRef, actionInputRef))) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_EXTRA",
        `DOM action-input tuple ${slotRef}/${actionInputRef} is outside target authority`,
        actionInputRef,
      ));
    }
  }

  const mappings: StitchRenderedActionInputMappingPayloadV3[] = [];
  for (const { placement, transport } of expected) {
    const matches = marked.filter(({ element }) =>
      stitchSemanticAttribute(element, "data-action-input-slot") === placement.controlSlotRef
      && stitchSemanticAttribute(element, "data-action-input") === transport.actionInputRef);
    if (matches.length === 0) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_MISSING",
        `Required action-input ${placement.controlSlotRef}/${transport.actionInputRef} has no exact DOM mapping`,
        transport.actionInputRef,
      ));
    }
    if (matches.length !== 1) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_DUPLICATE",
        `Required action-input ${placement.controlSlotRef}/${transport.actionInputRef} has ${matches.length} DOM mappings`,
        transport.actionInputRef,
      ));
    }
    const match = matches[0]!;
    if (
      !match.element.rendered
      || match.element.disabled
      || match.element.activeSurfaceRef !== placement.surfaceRef
      || enumOptions(match.element) === undefined
    ) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_DOM_INCOMPATIBLE",
        `Action-input ${transport.actionInputRef} is hidden, disabled, outside ${placement.surfaceRef}, or has invalid enum markers`,
        transport.actionInputRef,
      ));
    }
    const compatibility = checkActionInputDomCompatibilityV2(
      transport,
      domCandidate(match.element),
    );
    if (compatibility.status === "rejected") {
      const code = compatibility.rejectionCode
        === "CANDIDATE_ACTION_INPUT_CODEC_MARKER_MISMATCH"
        ? "RENDERED_SEMANTICS_V3_ACTION_INPUT_CODEC_MISMATCH"
        : "RENDERED_SEMANTICS_V3_ACTION_INPUT_DOM_INCOMPATIBLE";
      return reject(diagnostic(code, compatibility.message, transport.actionInputRef));
    }
    mappings.push({
      controlSlotRef: placement.controlSlotRef,
      actionInputRef: transport.actionInputRef,
      actionRef: transport.actionRef,
      elementRef: match.elementRef,
      sourceOrdinal: match.sourceOrdinal,
      tagName: match.element.tagName as "input" | "textarea" | "select",
      inputType: compatibility.matchedRequirement.inputType,
      valueChannel: compatibility.matchedRequirement.valueChannel,
      codecId: transport.codecId,
      transportHash: transport.contractHash,
      matchedDomRequirementHash: hashCanonicalJson(compatibility.matchedRequirement),
    });
  }
  return mappings.sort((left, right) => compareUtf16(
    `${left.controlSlotRef}\0${left.actionInputRef}`,
    `${right.controlSlotRef}\0${right.actionInputRef}`,
  ));
}

function compileObservableMappings(
  target: DesignGenerationTargetV3,
  elements: readonly IndexedElement[],
  surfaceMappings: readonly StitchRenderedSurfaceMappingPayloadV3[],
  controlMappings: readonly StitchRenderedControlMappingPayloadV3[],
): StitchRenderedObservableMappingPayloadV3[] | Rejected {
  const surfaceByRef = new Map(surfaceMappings.map((mapping) =>
    [mapping.surfaceRef, mapping] as const));
  const controlByRef = new Map(controlMappings.map((mapping) =>
    [mapping.controlSlotRef, mapping] as const));
  const mappings: StitchRenderedObservableMappingPayloadV3[] = [];
  for (const observable of target.requiredObservableSelectors) {
    const selector = observable.selector;
    if (selector.kind === "control") {
      const owner = controlByRef.get(selector.controlSlotRef);
      if (!owner) {
        return reject(diagnostic(
          "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPING_UNRESOLVED",
          `Observable ${observable.observableRef} cannot resolve control owner ${selector.controlSlotRef}`,
          observable.observableRef,
        ));
      }
      mappings.push({
        observableRef: observable.observableRef,
        actionRef: observable.actionRef,
        selectorKind: selector.kind,
        ownerKind: "control",
        ownerRef: selector.controlSlotRef,
        ownerElementRef: owner.elementRef,
        selectorElementRef: owner.elementRef,
        accessibilityRole: null,
        accessibilityName: null,
        observableHash: hashCanonicalJson(observable),
        selectorHash: hashCanonicalJson(selector),
      });
      continue;
    }
    const owner = surfaceByRef.get(selector.surfaceRef);
    if (!owner) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPING_UNRESOLVED",
        `Observable ${observable.observableRef} cannot resolve surface owner ${selector.surfaceRef}`,
        observable.observableRef,
      ));
    }
    if (selector.kind === "accessibility") {
      const matches = elements.filter(({ element }) =>
        element.rendered
        && element.activeSurfaceRef === selector.surfaceRef
        && stitchSemanticAttribute(element, "role") === selector.role
        && stitchSemanticAttribute(element, "aria-label") === selector.name);
      if (matches.length === 0) {
        return reject(diagnostic(
          "RENDERED_SEMANTICS_V3_ACCESSIBILITY_MAPPING_MISSING",
          `Accessibility observable ${observable.observableRef} requires one exact rendered role=${selector.role}/aria-label=${selector.name} element on ${selector.surfaceRef}`,
          observable.observableRef,
        ));
      }
      if (matches.length !== 1) {
        return reject(diagnostic(
          "RENDERED_SEMANTICS_V3_ACCESSIBILITY_MAPPING_DUPLICATE",
          `Accessibility observable ${observable.observableRef} resolved ${matches.length} exact rendered elements`,
          observable.observableRef,
        ));
      }
      const selectorElement = matches[0]!;
      mappings.push({
        observableRef: observable.observableRef,
        actionRef: observable.actionRef,
        selectorKind: selector.kind,
        ownerKind: "surface",
        ownerRef: selector.surfaceRef,
        ownerElementRef: owner.elementRef,
        selectorElementRef: selectorElement.elementRef,
        accessibilityRole: selector.role,
        accessibilityName: selector.name,
        observableHash: hashCanonicalJson(observable),
        selectorHash: hashCanonicalJson(selector),
      });
      continue;
    }
    mappings.push({
      observableRef: observable.observableRef,
      actionRef: observable.actionRef,
      selectorKind: selector.kind,
      ownerKind: "surface",
      ownerRef: selector.surfaceRef,
      ownerElementRef: owner.elementRef,
      selectorElementRef: owner.elementRef,
      accessibilityRole: null,
      accessibilityName: null,
      observableHash: hashCanonicalJson(observable),
      selectorHash: hashCanonicalJson(selector),
    });
  }
  return mappings.sort((left, right) =>
    compareUtf16(left.observableRef, right.observableRef));
}

function canonicalCandidate(input: Readonly<{
  operation: StitchRenderedSemanticsDirectEvidence["operations"][number];
  directCandidate: StitchRenderedSemanticsDirectEvidence["operations"][number]["candidates"][number];
  target: DesignGenerationTargetV3;
  targetAuthority: StitchRenderedTargetAuthorityV3;
  artifact: StitchRenderedCandidateArtifactBytesV3;
}>): StitchRenderedCandidateV3 | Rejected {
  const htmlBytes = input.artifact.htmlBytes;
  const screenshotBytes = input.artifact.screenshotBytes;
  if (!htmlBytes || !screenshotBytes) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_MISSING",
      "Every admitted candidate requires exact local HTML and screenshot bytes",
      compositeKey(input.directCandidate.requestRef, input.directCandidate.screenId),
    ));
  }
  if (
    htmlBytes.byteLength > MAX_HTML_BYTES_V3
    || screenshotBytes.byteLength > MAX_SCREENSHOT_BYTES_V3
  ) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_CAPACITY_EXCEEDED",
      `Artifact byte capacity exceeded (HTML ${htmlBytes.byteLength}/${MAX_HTML_BYTES_V3}, screenshot ${screenshotBytes.byteLength}/${MAX_SCREENSHOT_BYTES_V3})`,
      compositeKey(input.directCandidate.requestRef, input.directCandidate.screenId),
    ));
  }
  if (htmlBytes.byteLength === 0 || screenshotBytes.byteLength === 0) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_INVALID",
      "Admitted candidate HTML and screenshot byte arrays must be non-empty",
      compositeKey(input.directCandidate.requestRef, input.directCandidate.screenId),
    ));
  }
  const html = decodeExactUtf8(htmlBytes);
  if (typeof html !== "string") return html;
  if (!isValidStitchHtmlBytes(htmlBytes) || !isValidStitchScreenshotBytes(screenshotBytes)) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_INVALID",
      "Admitted candidate bytes fail the strict Stitch HTML or screenshot format",
      compositeKey(input.directCandidate.requestRef, input.directCandidate.screenId),
    ));
  }
  const htmlHash = sha256(htmlBytes);
  const screenshotHash = sha256(screenshotBytes);
  if (
    htmlHash !== input.directCandidate.htmlDownloadedArtifactHash
    || screenshotHash !== input.directCandidate.screenshotDownloadedArtifactHash
  ) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_HASH_MISMATCH",
      "Caller-supplied bytes do not equal the downloaded artifact hashes in exact DirectResponseEvidenceV3",
      compositeKey(input.directCandidate.requestRef, input.directCandidate.screenId),
    ));
  }
  const indexed = indexedElements(html);
  if ("status" in indexed) return indexed;
  const surfaceMappings = compileSurfaceMappings(input.targetAuthority, indexed);
  if ("status" in surfaceMappings) return surfaceMappings;
  const controlMappings = compileControlMappings(input.target, indexed);
  if ("status" in controlMappings) return controlMappings;
  const actionInputMappings = compileActionInputMappings(input.target, indexed);
  if ("status" in actionInputMappings) return actionInputMappings;
  const observableMappings = compileObservableMappings(
    input.target,
    indexed,
    surfaceMappings,
    controlMappings,
  );
  if ("status" in observableMappings) return observableMappings;
  const boundSurfaceMappings = surfaceMappings.map((mapping) => ({
    ...mapping,
    mappingHash: hashStitchRenderedSurfaceMappingV3(mapping),
  }));
  const boundControlMappings = controlMappings.map((mapping) => ({
    ...mapping,
    mappingHash: hashStitchRenderedControlMappingV3(mapping),
  }));
  const boundActionInputMappings = actionInputMappings.map((mapping) => ({
    ...mapping,
    mappingHash: hashStitchRenderedActionInputMappingV3(mapping),
  }));
  const boundObservableMappings = observableMappings.map((mapping) => ({
    ...mapping,
    mappingHash: hashStitchRenderedObservableMappingV3(mapping),
  }));
  const payload = {
    requestRef: input.directCandidate.requestRef,
    requestReceiptHash: input.directCandidate.requestReceiptHash,
    dispatchReceiptHash: input.directCandidate.dispatchReceiptHash,
    generationAuthorityHash: input.directCandidate.generationAuthorityHash,
    stageId: input.directCandidate.stageId,
    targetRef: input.directCandidate.targetRef,
    targetHash: input.directCandidate.targetHash,
    requestScreenKey: input.directCandidate.requestScreenKey,
    screenId: input.directCandidate.screenId,
    title: input.directCandidate.title,
    rawTransportArtifactHash: input.operation.rawTransportArtifactHash,
    providerResponseProjectionHash: input.operation.providerResponseProjectionHash,
    directCandidateHash: input.directCandidate.candidateHash,
    sourceEvidenceHash: input.directCandidate.sourceEvidenceHash,
    htmlSourceRefHash: input.directCandidate.htmlSourceRefHash!,
    screenshotSourceRefHash: input.directCandidate.screenshotSourceRefHash!,
    htmlArtifactHash: htmlHash,
    screenshotArtifactHash: screenshotHash,
    htmlByteLength: htmlBytes.byteLength,
    screenshotByteLength: screenshotBytes.byteLength,
    projectionStatus: "static_contract_projected" as const,
    targetAuthorityHash: input.targetAuthority.authorityHash,
    surfaceMappings: boundSurfaceMappings,
    surfaceMappingsHash: hashCanonicalJson(boundSurfaceMappings),
    controlMappings: boundControlMappings,
    controlMappingsHash: hashCanonicalJson(boundControlMappings),
    actionInputMappings: boundActionInputMappings,
    actionInputMappingsHash: hashCanonicalJson(boundActionInputMappings),
    observableMappings: boundObservableMappings,
    observableMappingsHash: hashCanonicalJson(boundObservableMappings),
  };
  return StitchRenderedSemanticsV3Schema.shape.candidates.element.parse({
    ...payload,
    candidateHash: hashStitchRenderedCandidateV3(payload),
  });
}

type StitchRenderedSemanticsDirectEvidence = Extract<
  ReturnType<typeof verifyStitchDirectResponseEvidenceV3>,
  { status: "verified" }
>["directResponseEvidence"];

/**
 * Deterministically reproduces static contract authority. Exact byte hashes are
 * checked, but the caller-supplied bytes are not represented as CAS-retrieved
 * and no browser replay is performed; the artifact records both boundaries.
 */
export function produceStitchRenderedSemanticsV3(
  input: CommonInputV3,
): StitchRenderedSemanticsProductionResultV3 {
  const direct = verifyStitchDirectResponseEvidenceV3({
    productSpec: input.productSpec,
    generationTargets: input.generationTargets,
    generationAuthority: input.generationAuthority,
    requests: input.requests,
    dispatchReceipts: input.dispatchReceipts,
    rawResponses: input.rawResponses,
    directResponseEvidence: input.directResponseEvidence,
  });
  if (direct.status !== "verified") {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_DIRECT_RESPONSE_INVALID",
      `DirectResponseEvidenceV3 failed exact reproduction: ${direct.rejectionCodes.join(",")}`,
      "directResponseEvidence",
    ));
  }
  const verifiedDirectResponse = direct.directResponseEvidence;
  const operationsWithoutAdmission = verifiedDirectResponse.operations.filter((operation) =>
    !operation.candidates.some((candidate) =>
      candidate.disposition === "admitted_renderable_screen"));
  if (operationsWithoutAdmission.length > 0) {
    return reject(...operationsWithoutAdmission.map((operation) => diagnostic(
      "RENDERED_SEMANTICS_V3_TARGET_ADMISSION_INCOMPLETE",
      `Target operation ${operation.request.targetRef} has no admitted renderable candidate`,
      operation.request.targetRef,
    )));
  }
  const parsedProductSpec = ProductSpecV2Schema.safeParse(input.productSpec);
  const parsedGenerationTargets = DesignGenerationTargetsV3Schema.safeParse(
    input.generationTargets,
  );
  const parsedGenerationAuthority = DesignSourceGenerationAuthorityV1Schema.safeParse(
    input.generationAuthority,
  );
  if (
    !parsedProductSpec.success
    || !parsedGenerationTargets.success
    || !parsedGenerationAuthority.success
  ) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_DIRECT_RESPONSE_INVALID",
      "Verified DirectResponseEvidenceV3 inputs no longer satisfy their canonical upstream schemas",
      "upstreamAuthority",
    ));
  }
  const productSpec = parsedProductSpec.data;
  const generationTargets = parsedGenerationTargets.data;
  const generationAuthority = parsedGenerationAuthority.data;
  const admitted = verifiedDirectResponse.operations.flatMap((operation) =>
    operation.candidates
      .filter((candidate) => candidate.disposition === "admitted_renderable_screen")
      .map((candidate) => ({ operation, candidate })));
  if (admitted.length === 0) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_NO_ADMITTED_CANDIDATE",
      "RenderedSemanticsV3 requires at least one exact admitted DirectResponseEvidenceV3 candidate",
      "directResponseEvidence",
    ));
  }
  if (
    !Array.isArray(input.artifacts)
    || input.artifacts.length > 10_000
    || !Array.from(input.artifacts).every(isCandidateArtifactBytesV3)
  ) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_SET_INVALID",
      "Candidate artifact bytes must be a bounded array of strict request/screen keys and optional Uint8Array payloads without unknown fields",
      "artifacts",
    ));
  }
  if (!artifactWorkWithinCapacityV3(input.artifacts)) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_WORK_CAPACITY_EXCEEDED",
      `Aggregate artifact byte work exceeds HTML ${MAX_TOTAL_HTML_BYTES_V3} or screenshot ${MAX_TOTAL_SCREENSHOT_BYTES_V3}`,
      "artifacts",
    ));
  }
  const expectedKeys = admitted.map(({ candidate }) =>
    compositeKey(candidate.requestRef, candidate.screenId)).sort(compareUtf16);
  const artifactKeys = input.artifacts.map((artifact) =>
    compositeKey(artifact.requestRef, artifact.screenId)).sort(compareUtf16);
  if (
    new Set(artifactKeys).size !== artifactKeys.length
    || canonicalJsonStringify(artifactKeys) !== canonicalJsonStringify(expectedKeys)
  ) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_SET_INVALID",
      "Artifact bytes must cover every and only admitted (requestRef,screenId) exactly once",
      "artifacts",
    ));
  }
  const artifactByKey = new Map(input.artifacts.map((artifact) =>
    [compositeKey(artifact.requestRef, artifact.screenId), artifact] as const));
  const targetByRef = new Map(generationTargets.targets.map((target) =>
    [target.targetId, target] as const));
  let targetAuthorities: StitchRenderedTargetAuthorityV3[];
  try {
    targetAuthorities = generationTargets.targets
      .map((target) => targetAuthority(productSpec, target))
      .sort((left, right) => compareUtf16(left.targetRef, right.targetRef));
  } catch (error) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_OUTPUT_INVALID",
      error instanceof Error ? error.message : "Target authority projection failed",
      "targetAuthorities",
    ));
  }
  const targetAuthorityByRef = new Map(targetAuthorities.map((authority) =>
    [authority.targetRef, authority] as const));
  const candidates: StitchRenderedCandidateV3[] = [];
  for (const entry of admitted) {
    const target = targetByRef.get(entry.candidate.targetRef);
    if (!target) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_TARGET_UNRESOLVED",
        `Admitted candidate target ${entry.candidate.targetRef} is absent from GenerationTargetsV3`,
        entry.candidate.targetRef,
      ));
    }
    const candidate = canonicalCandidate({
      operation: entry.operation,
      directCandidate: entry.candidate,
      target,
      targetAuthority: targetAuthorityByRef.get(target.targetId)!,
      artifact: artifactByKey.get(compositeKey(
        entry.candidate.requestRef,
        entry.candidate.screenId,
      ))!,
    });
    if ("status" in candidate) return candidate;
    candidates.push(candidate);
  }
  candidates.sort((left, right) => compareUtf16(
    compositeKey(left.requestRef, left.screenId),
    compositeKey(right.requestRef, right.screenId),
  ));
  const payload = {
    schema: STITCH_RENDERED_SEMANTICS_ARTIFACT_TYPE_V3,
    policy: STITCH_RENDERED_SEMANTICS_POLICY_V3,
    generationTargetsPayloadHash: generationTargets.payloadHash,
    generationAuthorityHash: verifiedDirectResponse.generationAuthority.authorityHash,
    directResponseEvidencePayloadHash: verifiedDirectResponse.payloadHash,
    verificationBoundary: {
      artifactReproduction: "deterministic_exact" as const,
      casRetrieval: "unverified_external_bytes" as const,
      browserReplay: "unverified_not_performed" as const,
    },
    targetAuthorities,
    targetAuthoritiesHash: hashCanonicalJson(targetAuthorities),
    candidates,
    candidatesHash: hashCanonicalJson(candidates),
  };
  if (
    generationAuthority.productSpecHash !== hashCanonicalJson(productSpec)
    || generationAuthority.generationTargetsHash !== hashCanonicalJson(generationTargets)
  ) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_DIRECT_RESPONSE_INVALID",
      "Parent generation authority no longer equals the exact ProductSpec/GenerationTargets inputs",
      "generationAuthority",
    ));
  }
  const output = StitchRenderedSemanticsV3Schema.safeParse({
    ...payload,
    payloadHash: hashStitchRenderedSemanticsV3(payload),
  });
  if (!output.success) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_OUTPUT_INVALID",
      `RenderedSemanticsV3 failed at ${firstIssue(output.error)}`,
      "renderedSemantics",
    ));
  }
  return {
    status: "produced_unverified_browser_cas",
    renderedSemantics: output.data,
    diagnostics: [],
  };
}

/** Exact artifact reproduction; this does not upgrade the CAS/browser boundary. */
export function verifyStitchRenderedSemanticsV3(
  input: CommonInputV3 & Readonly<{ renderedSemantics: unknown }>,
): StitchRenderedSemanticsReproductionResultV3 {
  const actual = StitchRenderedSemanticsV3Schema.safeParse(input.renderedSemantics);
  if (!actual.success) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_REPRODUCTION_INPUT_INVALID",
      `Serialized RenderedSemanticsV3 failed at ${firstIssue(actual.error)}`,
      "renderedSemantics",
    ));
  }
  const reproduced = produceStitchRenderedSemanticsV3(input);
  if (reproduced.status === "rejected") return reproduced;
  if (
    canonicalJsonStringify(actual.data)
      !== canonicalJsonStringify(reproduced.renderedSemantics)
    || hashCanonicalJson(actual.data)
      !== hashCanonicalJson(reproduced.renderedSemantics)
  ) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_AUTHORITY_MISMATCH",
      "RenderedSemanticsV3 does not equal the fresh deterministic projection of exact upstream authority and caller-supplied bytes",
      "renderedSemantics",
    ));
  }
  return {
    status: "reproduced_unverified_browser_cas",
    renderedSemantics: reproduced.renderedSemantics,
    diagnostics: [],
  };
}
