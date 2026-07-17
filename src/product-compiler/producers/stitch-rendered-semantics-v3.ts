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
  STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3,
  StitchRenderedSemanticsV3Schema,
  StitchRenderedTargetAuthorityV3Schema,
  hashStitchRenderedActionInputMappingV3,
  hashStitchRenderedCandidateV3,
  hashStitchRenderedControlMappingV3,
  hashStitchRenderedObservableMappingV3,
  hashStitchRenderedSemanticsV3,
  hashStitchRenderedStaticFailureReceiptV3,
  hashStitchRenderedSurfaceMappingV3,
  hashStitchRenderedTargetAuthorityV3,
  parseStitchRenderedSemanticsV3,
  type StitchRenderedActionInputMappingPayloadV3,
  type StitchRenderedCandidateV3,
  type StitchRenderedControlMappingPayloadV3,
  type StitchRenderedObservableMappingPayloadV3,
  type StitchRenderedSemanticsV3,
  type StitchRenderedStaticFailureCodeV3,
  type StitchRenderedStaticFailureReceiptV3,
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
  artifacts: unknown;
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

type CandidateArtifactSnapshotResultV3 =
  | Readonly<{
      status: "snapshotted";
      artifacts: readonly StitchRenderedCandidateArtifactBytesV3[];
    }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "capacity_exceeded" }>;

const TYPED_ARRAY_BYTE_LENGTH_GETTER_V3 = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype) as object,
  "byteLength",
)?.get;

function snapshotBytesV3(
  value: unknown,
  remainingBytes: number,
): Uint8Array | "invalid" | "capacity_exceeded" | undefined {
  if (value === undefined) return undefined;
  // ArrayBuffer.isView rejects a Proxy around a typed array without invoking
  // attacker-controlled traps. The intrinsic getter/set below avoid subclass
  // property overrides while copying into producer-owned bytes.
  if (!ArrayBuffer.isView(value) || !(value instanceof Uint8Array)) {
    return "invalid";
  }
  if (!TYPED_ARRAY_BYTE_LENGTH_GETTER_V3) return "invalid";
  const byteLength = Reflect.apply(
    TYPED_ARRAY_BYTE_LENGTH_GETTER_V3,
    value,
    [],
  ) as number;
  if (byteLength > remainingBytes) return "capacity_exceeded";
  const snapshot = new Uint8Array(byteLength);
  Reflect.apply(Uint8Array.prototype.set, snapshot, [value, 0]);
  return snapshot;
}

function snapshotCandidateArtifactV3(
  value: unknown,
  remainingHtmlBytes: number,
  remainingScreenshotBytes: number,
):
  | Readonly<{
      status: "snapshotted";
      artifact: StitchRenderedCandidateArtifactBytesV3;
    }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "capacity_exceeded" }> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { status: "invalid" };
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return { status: "invalid" };
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string" || !ARTIFACT_KEYS_V3.has(key))
    || !keys.includes("requestRef")
    || !keys.includes("screenId")
  ) {
    return { status: "invalid" };
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of keys) {
    const descriptor = descriptors[key as string];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      return { status: "invalid" };
    }
  }
  const requestRef = descriptors.requestRef?.value;
  const screenId = descriptors.screenId?.value;
  if (
    !DesignSourceGenerationRequestV3Schema.shape.requestRef.safeParse(requestRef).success
    || !ScreenIdV3Schema.safeParse(screenId).success
  ) {
    return { status: "invalid" };
  }
  const htmlBytes = snapshotBytesV3(
    descriptors.htmlBytes?.value,
    remainingHtmlBytes,
  );
  const screenshotBytes = snapshotBytesV3(
    descriptors.screenshotBytes?.value,
    remainingScreenshotBytes,
  );
  if (htmlBytes === "capacity_exceeded" || screenshotBytes === "capacity_exceeded") {
    return { status: "capacity_exceeded" };
  }
  if (htmlBytes === "invalid" || screenshotBytes === "invalid") {
    return { status: "invalid" };
  }
  return {
    status: "snapshotted",
    artifact: {
      requestRef,
      screenId,
      ...(htmlBytes === undefined ? {} : { htmlBytes }),
      ...(screenshotBytes === undefined ? {} : { screenshotBytes }),
    },
  };
}

function snapshotCandidateArtifactsV3(
  value: unknown,
): CandidateArtifactSnapshotResultV3 {
  try {
    if (!Array.isArray(value)) return { status: "invalid" };
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
    const rawLength = lengthDescriptor && "value" in lengthDescriptor
      ? lengthDescriptor.value
      : undefined;
    if (
      typeof rawLength !== "number"
      || !Number.isInteger(rawLength)
      || rawLength < 0
      || rawLength > 10_000
    ) {
      return { status: "invalid" };
    }
    const length = rawLength;
    const expectedKeys = new Set<string>([
      "length",
      ...Array.from({ length }, (_, index) => String(index)),
    ]);
    if (Reflect.ownKeys(value).some((key) =>
      typeof key !== "string" || !expectedKeys.has(key))) {
      return { status: "invalid" };
    }
    const artifacts: StitchRenderedCandidateArtifactBytesV3[] = [];
    let htmlBytes = 0;
    let screenshotBytes = 0;
    for (let index = 0; index < length; index += 1) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        return { status: "invalid" };
      }
      const snapshot = snapshotCandidateArtifactV3(
        descriptor.value,
        MAX_TOTAL_HTML_BYTES_V3 - htmlBytes,
        MAX_TOTAL_SCREENSHOT_BYTES_V3 - screenshotBytes,
      );
      if (snapshot.status !== "snapshotted") return snapshot;
      htmlBytes += snapshot.artifact.htmlBytes?.byteLength ?? 0;
      screenshotBytes += snapshot.artifact.screenshotBytes?.byteLength ?? 0;
      artifacts.push(snapshot.artifact);
    }
    return { status: "snapshotted", artifacts };
  } catch {
    return { status: "invalid" };
  }
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
  elementRef: SourceElementRefV3;
  sourceOrdinal: number;
}>;

type SourceElementRefV3 = `S${string}`;

type StaticFailureOwnerV3 =
  | "source_validation"
  | "semantic_indexing"
  | "surface_mapping"
  | "control_mapping"
  | "action_input_mapping"
  | "observable_mapping";

const STATIC_FAILURE_OWNER_BY_CODE_V3 = Object.freeze({
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
  StaticFailureOwnerV3
>>);

type StaticFailureSemanticRefV3 = Readonly<{
  kind:
    | "surface"
    | "control_slot"
    | "action"
    | "action_input"
    | "observable"
    | "contract_attribute";
  ref: string;
}>;

type CandidateStaticFailureV3 = Readonly<{
  status: "candidate_static_failure";
  owner: StaticFailureOwnerV3;
  code: StitchRenderedStaticFailureCodeV3;
  semanticRefs: readonly StaticFailureSemanticRefV3[];
  sourceElementRefs: readonly SourceElementRefV3[];
  displayDiagnostic: CompilationDiagnosticV1;
}>;

function staticFailure<Code extends StitchRenderedStaticFailureCodeV3>(
  code: Code,
  owner: (typeof STATIC_FAILURE_OWNER_BY_CODE_V3)[Code],
  message: string,
  semanticRefs: readonly StaticFailureSemanticRefV3[] = [],
  sourceElementRefs: readonly SourceElementRefV3[] = [],
): CandidateStaticFailureV3 {
  if (STATIC_FAILURE_OWNER_BY_CODE_V3[code] !== owner) {
    throw new Error(`Static failure ${code} cannot be emitted by ${owner}`);
  }
  return {
    status: "candidate_static_failure",
    owner,
    code,
    semanticRefs,
    sourceElementRefs,
    // Human-readable diagnostics are deliberately not an authority transport.
    displayDiagnostic: diagnostic(code, message),
  };
}

function isCandidateStaticFailureV3(
  value: unknown,
): value is CandidateStaticFailureV3 {
  return value !== null
    && typeof value === "object"
    && (value as CandidateStaticFailureV3).status === "candidate_static_failure";
}

function sourceElementRefV3(sourceOrdinal: number): SourceElementRefV3 {
  return `S${String(sourceOrdinal + 1).padStart(6, "0")}`;
}

function indexedElements(html: string): IndexedElement[] | CandidateStaticFailureV3 {
  let elements: StitchSemanticElementV1[];
  try {
    elements = parseStitchSemanticDomV1(html);
  } catch {
    return staticFailure(
      "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_INVALID",
      "source_validation",
      "Rendered HTML could not be parsed into the bounded static semantic DOM",
    );
  }
  if (elements.length > MAX_SEMANTIC_ELEMENTS_V3) {
    return staticFailure(
      "RENDERED_SEMANTICS_V3_ELEMENT_CAPACITY_EXCEEDED",
      "semantic_indexing",
      `Rendered HTML contains ${elements.length} semantic elements; maximum is ${MAX_SEMANTIC_ELEMENTS_V3}`,
    );
  }
  const indexed = elements.map((element, sourceOrdinal) => ({
    element,
    elementRef: sourceElementRefV3(sourceOrdinal),
    sourceOrdinal,
  }));
  const duplicate = indexed.flatMap((entry) =>
    entry.element.duplicateAttributes
      .filter((attribute) => CONTRACT_ATTRIBUTES_V3.has(attribute))
      .map((attribute) => ({ attribute, elementRef: entry.elementRef })));
  if (duplicate.length > 0) {
    const attributes = uniqueSorted(duplicate.map((entry) => entry.attribute));
    return staticFailure(
      "RENDERED_SEMANTICS_V3_CONTRACT_ATTRIBUTE_DUPLICATE",
      "semantic_indexing",
      `Contract attributes must occur at most once per element: ${attributes.join(",")}`,
      attributes.map((attribute) => ({
        kind: "contract_attribute",
        ref: attribute,
      })),
      uniqueSorted(duplicate.map((entry) => entry.elementRef)),
    );
  }
  return indexed;
}

function decodeExactUtf8(htmlBytes: Uint8Array): string | CandidateStaticFailureV3 {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(htmlBytes);
    const roundTrip = Buffer.from(decoded, "utf8");
    const original = Buffer.from(
      htmlBytes.buffer,
      htmlBytes.byteOffset,
      htmlBytes.byteLength,
    );
    if (!roundTrip.equals(original)) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_HTML_ENCODING_INVALID",
        "source_validation",
        "Rendered HTML must be canonical UTF-8 whose decoded text round-trips to the exact input bytes",
      );
    }
    return decoded;
  } catch {
    return staticFailure(
      "RENDERED_SEMANTICS_V3_HTML_ENCODING_INVALID",
      "source_validation",
      "Rendered HTML contains a fatal UTF-8 decoding error",
    );
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
): StitchRenderedSurfaceMappingPayloadV3[] | CandidateStaticFailureV3 {
  const expectedByRef = new Map(authority.surfaces.map((surface) =>
    [surface.surfaceRef, surface] as const));
  const marked = elements.filter(({ element }) =>
    stitchSemanticAttribute(element, "data-surface-id") !== undefined);
  for (const entry of marked) {
    const surfaceRef = stitchSemanticAttribute(entry.element, "data-surface-id");
    if (!surfaceRef || !expectedByRef.has(surfaceRef)) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_EXTRA",
        "surface_mapping",
        "Every rendered surface marker must identify one exact target surface",
        surfaceRef ? [{ kind: "surface", ref: surfaceRef }] : [],
        [entry.elementRef],
      );
    }
  }

  const mappings: StitchRenderedSurfaceMappingPayloadV3[] = [];
  for (const surface of authority.surfaces) {
    const matches = marked.filter(({ element }) =>
      stitchSemanticAttribute(element, "data-surface-id") === surface.surfaceRef);
    if (matches.length === 0) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_MISSING",
        "surface_mapping",
        `Required surface ${surface.surfaceRef} has no exact DOM mapping`,
        [{ kind: "surface", ref: surface.surfaceRef }],
      );
    }
    if (matches.length !== 1) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_DUPLICATE",
        "surface_mapping",
        `Required surface ${surface.surfaceRef} has ${matches.length} DOM mappings`,
        [{ kind: "surface", ref: surface.surfaceRef }],
        matches.map((match) => match.elementRef),
      );
    }
    const match = matches[0]!;
    if (
      !match.element.rendered
      || match.element.activeSurfaceRef !== surface.surfaceRef
    ) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_INVALID",
        "surface_mapping",
        `Surface ${surface.surfaceRef} must be an exact rendered DOM owner`,
        [{ kind: "surface", ref: surface.surfaceRef }],
        [match.elementRef],
      );
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
): StitchRenderedControlMappingPayloadV3[] | CandidateStaticFailureV3 {
  const expectedBySlot = new Map(target.requiredControlPlacements.map((placement) =>
    [placement.controlSlotRef, placement] as const));
  const marked = elements.filter(({ element }) =>
    stitchSemanticAttribute(element, "data-control-slot") !== undefined
    || stitchSemanticAttribute(element, "data-action") !== undefined);
  for (const entry of marked) {
    const slotRef = stitchSemanticAttribute(entry.element, "data-control-slot");
    const actionRef = stitchSemanticAttribute(entry.element, "data-action");
    const placement = slotRef ? expectedBySlot.get(slotRef) : undefined;
    if (!slotRef || !actionRef || !placement || placement.actionRef !== actionRef) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_EXTRA",
        "control_mapping",
        "Every action/control marker must identify one required target control tuple",
        [
          ...(slotRef ? [{ kind: "control_slot" as const, ref: slotRef }] : []),
          ...(actionRef ? [{ kind: "action" as const, ref: actionRef }] : []),
        ],
        [entry.elementRef],
      );
    }
  }

  const mappings: StitchRenderedControlMappingPayloadV3[] = [];
  for (const placement of target.requiredControlPlacements) {
    const matches = marked.filter(({ element }) =>
      stitchSemanticAttribute(element, "data-control-slot") === placement.controlSlotRef
      && stitchSemanticAttribute(element, "data-action") === placement.actionRef);
    if (matches.length === 0) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_MISSING",
        "control_mapping",
        `Required control ${placement.controlSlotRef}/${placement.actionRef} has no exact DOM mapping`,
        [
          { kind: "control_slot", ref: placement.controlSlotRef },
          { kind: "action", ref: placement.actionRef },
        ],
      );
    }
    if (matches.length !== 1) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_DUPLICATE",
        "control_mapping",
        `Required control ${placement.controlSlotRef}/${placement.actionRef} has ${matches.length} DOM mappings`,
        [
          { kind: "control_slot", ref: placement.controlSlotRef },
          { kind: "action", ref: placement.actionRef },
        ],
        matches.map((match) => match.elementRef),
      );
    }
    const match = matches[0]!;
    if (
      !isNativeStitchActionElementV1(match.element)
      || match.element.activeSurfaceRef !== placement.surfaceRef
    ) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_INVALID",
        "control_mapping",
        `Control ${placement.controlSlotRef} must be an enabled native action element on ${placement.surfaceRef}`,
        [
          { kind: "control_slot", ref: placement.controlSlotRef },
          { kind: "action", ref: placement.actionRef },
        ],
        [match.elementRef],
      );
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

function actionInputFailureSemanticRefs(
  placement: DesignGenerationTargetV3["requiredControlPlacements"][number],
  transport: ActionInputTransportV2,
): StaticFailureSemanticRefV3[] {
  return [
    { kind: "control_slot", ref: placement.controlSlotRef },
    { kind: "action", ref: transport.actionRef },
    { kind: "action_input", ref: transport.actionInputRef },
  ];
}

function compileActionInputMappings(
  target: DesignGenerationTargetV3,
  elements: readonly IndexedElement[],
): StitchRenderedActionInputMappingPayloadV3[] | CandidateStaticFailureV3 {
  const expected = expectedInputTuples(target);
  const expectedByKey = new Map(expected.map((entry) => [
    compositeKey(entry.placement.controlSlotRef, entry.transport.actionInputRef),
    entry,
  ] as const));
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
      return staticFailure(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_MARKER_INVALID",
        "action_input_mapping",
        "Action-input elements require data-action-input-slot, data-action-input, and data-action-input-codec together",
        [
          ...(slotRef ? [{ kind: "control_slot" as const, ref: slotRef }] : []),
          ...(actionInputRef
            ? [{ kind: "action_input" as const, ref: actionInputRef }]
            : []),
        ],
        [entry.elementRef],
      );
    }
    if (!expectedByKey.has(compositeKey(slotRef, actionInputRef))) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_EXTRA",
        "action_input_mapping",
        `DOM action-input tuple ${slotRef}/${actionInputRef} is outside target authority`,
        [
          { kind: "control_slot", ref: slotRef },
          { kind: "action_input", ref: actionInputRef },
        ],
        [entry.elementRef],
      );
    }
  }

  const mappings: StitchRenderedActionInputMappingPayloadV3[] = [];
  for (const { placement, transport } of expected) {
    const matches = marked.filter(({ element }) =>
      stitchSemanticAttribute(element, "data-action-input-slot") === placement.controlSlotRef
      && stitchSemanticAttribute(element, "data-action-input") === transport.actionInputRef);
    if (matches.length === 0) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_MISSING",
        "action_input_mapping",
        `Required action-input ${placement.controlSlotRef}/${transport.actionInputRef} has no exact DOM mapping`,
        actionInputFailureSemanticRefs(placement, transport),
      );
    }
    if (matches.length !== 1) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_DUPLICATE",
        "action_input_mapping",
        `Required action-input ${placement.controlSlotRef}/${transport.actionInputRef} has ${matches.length} DOM mappings`,
        actionInputFailureSemanticRefs(placement, transport),
        matches.map((match) => match.elementRef),
      );
    }
    const match = matches[0]!;
    if (
      !match.element.rendered
      || match.element.disabled
      || match.element.activeSurfaceRef !== placement.surfaceRef
      || enumOptions(match.element) === undefined
    ) {
      return staticFailure(
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_DOM_INCOMPATIBLE",
        "action_input_mapping",
        `Action-input ${transport.actionInputRef} is hidden, disabled, outside ${placement.surfaceRef}, or has invalid enum markers`,
        actionInputFailureSemanticRefs(placement, transport),
        [match.elementRef],
      );
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
      return staticFailure(
        code,
        "action_input_mapping",
        compatibility.message,
        actionInputFailureSemanticRefs(placement, transport),
        [match.elementRef],
      );
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
  surfaceMappings: readonly StitchRenderedSurfaceMappingPayloadV3[],
  controlMappings: readonly StitchRenderedControlMappingPayloadV3[],
): StitchRenderedObservableMappingPayloadV3[] | CandidateStaticFailureV3 {
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
        return staticFailure(
          "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPING_UNRESOLVED",
          "observable_mapping",
          `Observable ${observable.observableRef} cannot resolve control owner ${selector.controlSlotRef}`,
          [
            { kind: "observable", ref: observable.observableRef },
            { kind: "action", ref: observable.actionRef },
            { kind: "control_slot", ref: selector.controlSlotRef },
          ],
        );
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
      return staticFailure(
        "RENDERED_SEMANTICS_V3_OBSERVABLE_MAPPING_UNRESOLVED",
        "observable_mapping",
        `Observable ${observable.observableRef} cannot resolve surface owner ${selector.surfaceRef}`,
        [
          { kind: "observable", ref: observable.observableRef },
          { kind: "action", ref: observable.actionRef },
          { kind: "surface", ref: selector.surfaceRef },
        ],
      );
    }
    if (selector.kind === "accessibility") {
      mappings.push({
        observableRef: observable.observableRef,
        actionRef: observable.actionRef,
        selectorKind: selector.kind,
        ownerKind: "surface",
        ownerRef: selector.surfaceRef,
        ownerElementRef: owner.elementRef,
        selectorElementRef: null,
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

type CanonicalCandidateInputV3 = Readonly<{
  operation: StitchRenderedSemanticsDirectEvidence["operations"][number];
  directCandidate: StitchRenderedSemanticsDirectEvidence["operations"][number]["candidates"][number];
  target: DesignGenerationTargetV3;
  targetAuthority: StitchRenderedTargetAuthorityV3;
  artifact: StitchRenderedCandidateArtifactBytesV3;
}>;

function candidateIdentityPayload(
  input: CanonicalCandidateInputV3,
  htmlHash: string,
  screenshotHash: string,
) {
  return {
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
    htmlByteLength: input.artifact.htmlBytes!.byteLength,
    screenshotByteLength: input.artifact.screenshotBytes!.byteLength,
    targetAuthorityHash: input.targetAuthority.authorityHash,
  };
}

function staticFailureReceipt(
  base: ReturnType<typeof candidateIdentityPayload>,
  failure: CandidateStaticFailureV3,
): StitchRenderedStaticFailureReceiptV3 {
  const semanticRefByKey = new Map<
    string,
    StitchRenderedStaticFailureReceiptV3["semanticRefs"][number]
  >();
  for (const reference of [
    { kind: "target" as const, ref: base.targetRef },
    ...failure.semanticRefs,
  ]) {
    semanticRefByKey.set(`${reference.kind}\0${reference.ref}`, reference);
  }
  const semanticRefs = [...semanticRefByKey.values()].sort((left, right) => compareUtf16(
    `${left.kind}\0${left.ref}`,
    `${right.kind}\0${right.ref}`,
  ));
  const exactSourceElementRefs = uniqueSorted(failure.sourceElementRefs);
  const sourceRefs: StitchRenderedStaticFailureReceiptV3["sourceRefs"] = [
    { kind: "html_source", ref: base.htmlSourceRefHash },
    { kind: "screenshot_source", ref: base.screenshotSourceRefHash },
    ...exactSourceElementRefs.slice(
      0,
      STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3,
    ).map((ref) => ({
      kind: "source_element" as const,
      ref,
    })),
  ];
  sourceRefs.sort((left, right) => compareUtf16(
    `${left.kind}\0${left.ref}`,
    `${right.kind}\0${right.ref}`,
  ));
  const payload = {
    requestRef: base.requestRef,
    screenId: base.screenId,
    targetRef: base.targetRef,
    directCandidateHash: base.directCandidateHash,
    htmlArtifactHash: base.htmlArtifactHash,
    screenshotArtifactHash: base.screenshotArtifactHash,
    phase: failure.owner,
    code: failure.code,
    semanticRefs,
    sourceElementRefCount: exactSourceElementRefs.length,
    sourceElementRefsHash: hashCanonicalJson(exactSourceElementRefs),
    sourceRefs,
  };
  return {
    ...payload,
    receiptHash: hashStitchRenderedStaticFailureReceiptV3(payload),
  };
}

function staticSourceRejectedCandidate(
  base: ReturnType<typeof candidateIdentityPayload>,
  failure: CandidateStaticFailureV3,
): StitchRenderedCandidateV3 {
  const failureReceipts = [staticFailureReceipt(base, failure)];
  const payload = {
    ...base,
    projectionStatus: "static_source_rejected" as const,
    failureReceipts,
    failureReceiptsHash: hashCanonicalJson(failureReceipts),
  };
  return StitchRenderedSemanticsV3Schema.shape.candidates.element.parse({
    ...payload,
    candidateHash: hashStitchRenderedCandidateV3(payload),
  });
}

function canonicalCandidate(
  input: CanonicalCandidateInputV3,
): StitchRenderedCandidateV3 | Rejected {
  const htmlBytes = input.artifact.htmlBytes;
  const screenshotBytes = input.artifact.screenshotBytes;
  if (!htmlBytes || !screenshotBytes) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_MISSING",
      "Every admitted candidate requires exact local HTML and screenshot bytes",
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
  const base = candidateIdentityPayload(input, htmlHash, screenshotHash);
  if (
    htmlBytes.byteLength > MAX_HTML_BYTES_V3
    || screenshotBytes.byteLength > MAX_SCREENSHOT_BYTES_V3
  ) {
    return staticSourceRejectedCandidate(base, staticFailure(
      "RENDERED_SEMANTICS_V3_ARTIFACT_CAPACITY_EXCEEDED",
      "source_validation",
      `Artifact byte capacity exceeded (HTML ${htmlBytes.byteLength}/${MAX_HTML_BYTES_V3}, screenshot ${screenshotBytes.byteLength}/${MAX_SCREENSHOT_BYTES_V3})`,
    ));
  }
  if (htmlBytes.byteLength === 0 || screenshotBytes.byteLength === 0) {
    return staticSourceRejectedCandidate(base, staticFailure(
      "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_INVALID",
      "source_validation",
      "Admitted candidate HTML and screenshot byte arrays must be non-empty",
    ));
  }
  const html = decodeExactUtf8(htmlBytes);
  if (isCandidateStaticFailureV3(html)) {
    return staticSourceRejectedCandidate(base, html);
  }
  if (!isValidStitchHtmlBytes(htmlBytes) || !isValidStitchScreenshotBytes(screenshotBytes)) {
    return staticSourceRejectedCandidate(base, staticFailure(
      "RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_INVALID",
      "source_validation",
      "Admitted candidate bytes fail the strict Stitch HTML or screenshot format",
    ));
  }
  const indexed = indexedElements(html);
  if (isCandidateStaticFailureV3(indexed)) {
    return staticSourceRejectedCandidate(base, indexed);
  }
  const surfaceMappings = compileSurfaceMappings(input.targetAuthority, indexed);
  if (isCandidateStaticFailureV3(surfaceMappings)) {
    return staticSourceRejectedCandidate(base, surfaceMappings);
  }
  const controlMappings = compileControlMappings(input.target, indexed);
  if (isCandidateStaticFailureV3(controlMappings)) {
    return staticSourceRejectedCandidate(base, controlMappings);
  }
  const actionInputMappings = compileActionInputMappings(input.target, indexed);
  if (isCandidateStaticFailureV3(actionInputMappings)) {
    return staticSourceRejectedCandidate(base, actionInputMappings);
  }
  const observableMappings = compileObservableMappings(
    input.target,
    surfaceMappings,
    controlMappings,
  );
  if (isCandidateStaticFailureV3(observableMappings)) {
    return staticSourceRejectedCandidate(base, observableMappings);
  }
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
    ...base,
    projectionStatus: "static_contract_projected" as const,
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
  let artifactSnapshot: CandidateArtifactSnapshotResultV3;
  try {
    artifactSnapshot = snapshotCandidateArtifactsV3(input.artifacts);
  } catch {
    // Accessing `input.artifacts` itself may execute an in-process Proxy trap.
    artifactSnapshot = { status: "invalid" };
  }
  if (artifactSnapshot.status === "invalid") {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_SET_INVALID",
      "Candidate artifact bytes must be a bounded dense array of ordinary strict request/screen records and producer-snapshotted Uint8Array payloads",
      "artifacts",
    ));
  }
  if (artifactSnapshot.status === "capacity_exceeded") {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_ARTIFACT_WORK_CAPACITY_EXCEEDED",
      `Aggregate artifact byte work exceeds HTML ${MAX_TOTAL_HTML_BYTES_V3} or screenshot ${MAX_TOTAL_SCREENSHOT_BYTES_V3}`,
      "artifacts",
    ));
  }
  const artifacts = artifactSnapshot.artifacts;
  const expectedKeys = admitted.map(({ candidate }) =>
    compositeKey(candidate.requestRef, candidate.screenId)).sort(compareUtf16);
  const artifactKeys = artifacts.map((artifact) =>
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
  const artifactByKey = new Map(artifacts.map((artifact) =>
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
    let candidate: StitchRenderedCandidateV3 | Rejected;
    try {
      candidate = canonicalCandidate({
        operation: entry.operation,
        directCandidate: entry.candidate,
        target,
        targetAuthority: targetAuthorityByRef.get(target.targetId)!,
        artifact: artifactByKey.get(compositeKey(
          entry.candidate.requestRef,
          entry.candidate.screenId,
        ))!,
      });
    } catch (error) {
      return reject(diagnostic(
        "RENDERED_SEMANTICS_V3_OUTPUT_INVALID",
        error instanceof Error ? error.message : "Candidate outcome construction failed",
        compositeKey(entry.candidate.requestRef, entry.candidate.screenId),
      ));
    }
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
  let output: ReturnType<typeof StitchRenderedSemanticsV3Schema.safeParse>;
  try {
    output = StitchRenderedSemanticsV3Schema.safeParse({
      ...payload,
      payloadHash: hashStitchRenderedSemanticsV3(payload),
    });
  } catch (error) {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_OUTPUT_INVALID",
      error instanceof Error ? error.message : "RenderedSemanticsV3 hashing failed",
      "renderedSemantics",
    ));
  }
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
  const actual = parseStitchRenderedSemanticsV3(input.renderedSemantics);
  if (actual.status === "rejected") {
    return reject(diagnostic(
      "RENDERED_SEMANTICS_V3_REPRODUCTION_INPUT_INVALID",
      `Serialized RenderedSemanticsV3 failed at ${actual.issuePath}: ${actual.issueMessage}`,
      "renderedSemantics",
    ));
  }
  const reproduced = produceStitchRenderedSemanticsV3(input);
  if (reproduced.status === "rejected") return reproduced;
  if (
    canonicalJsonStringify(actual.renderedSemantics)
      !== canonicalJsonStringify(reproduced.renderedSemantics)
    || hashCanonicalJson(actual.renderedSemantics)
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
