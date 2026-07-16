import { createHash } from "node:crypto";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  isValidStitchHtmlBytes,
  isValidStitchScreenshotBytes,
} from "../stitch-render-artifact.js";
import {
  parseStitchSemanticDomV1,
  stitchSemanticAttribute,
} from "../stitch-semantic-dom-v1.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import { parseStitchDirectResponseEvidence } from "../compatibility/stitch-direct-response-evidence.js";
import { produceStitchTargetCandidateSelectionFailureV1 } from "./stitch-target-candidate-selection-failure.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  DesignGenerationTargetsV1Schema,
  type DesignGenerationTargetV1,
} from "../schemas/design-generation-targets-v1.js";
import {
  STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V1,
  StitchTargetCandidateSelectionV1Schema,
  StitchTargetResponseBindingsV2Schema,
  type StitchCandidateEvaluationV1,
  type StitchCandidateFactV1,
  type StitchTargetCandidateSelectionV1,
  type StitchTargetResponseBindingsV2,
} from "../schemas/stitch-target-candidate-selection-v1.js";
import type { StitchTargetCandidateSelectionFailureV1 } from "../schemas/stitch-target-candidate-selection-failure-v1.js";
import {
  StitchRenderedSemanticsV1Schema,
  type StitchRenderedElementV1,
  type StitchRenderedSemanticsV1,
} from "../schemas/stitch-rendered-semantics-v1.js";

export type StitchCandidateArtifactBytesV1 = Readonly<{
  screenId: string;
  htmlBytes?: Uint8Array;
  screenshotBytes?: Uint8Array;
}>;

type Rejected = Readonly<{
  status: "rejected";
  rejectionCodes: string[];
  diagnostics: CompilationDiagnosticV1[];
  candidateSelection?: StitchTargetCandidateSelectionV1;
  candidateSelectionFailure?: StitchTargetCandidateSelectionFailureV1;
}>;

export type StitchCandidateSelectionResultV1 =
  | Readonly<{
      status: "produced";
      candidateSelection: StitchTargetCandidateSelectionV1;
      diagnostics: readonly [];
    }>
  | Rejected;

export type StitchTargetBindingResultV2 =
  | Readonly<{
      status: "produced";
      responseBindings: StitchTargetResponseBindingsV2;
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

function diagnostic(code: string, message: string, reference?: string): CompilationDiagnosticV1 {
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

function reject(
  diagnostics: CompilationDiagnosticV1[],
  candidateSelection?: StitchTargetCandidateSelectionV1,
  candidateSelectionFailure?: StitchTargetCandidateSelectionFailureV1,
): Rejected {
  const sorted = sortCompilationDiagnostics(diagnostics);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
    ...(candidateSelection ? { candidateSelection } : {}),
    ...(candidateSelectionFailure ? { candidateSelectionFailure } : {}),
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

type SemanticCheck = StitchCandidateEvaluationV1["semanticChecks"][number];

type SemanticElement = Readonly<{
  elementRef: string;
  tagName: string;
  activeSurfaceRef: string | null;
  ownSurfaceRef: string | null;
  dataAction: string | null;
  dataActionInput: string | null;
  role: string | null;
  ariaLabel: string | null;
  href: string | null;
  nativeControlKind: StitchRenderedElementV1["nativeControlKind"];
  interactiveRole: boolean;
  rendered: boolean;
  enabled: boolean;
  pointerOperable: boolean;
  duplicateContractAttributes: readonly string[];
}>;

function safeScreenId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/.test(value);
}

function browserSemanticElements(elements: readonly StitchRenderedElementV1[]): SemanticElement[] {
  return elements.map((element) => ({
    elementRef: element.elementRef,
    tagName: element.tagName,
    activeSurfaceRef: element.nearestSurfaceRef,
    ownSurfaceRef: element.ownSurfaceRef,
    dataAction: element.dataAction,
    dataActionInput: element.dataActionInput,
    role: element.role,
    ariaLabel: element.ariaLabel,
    href: element.href,
    nativeControlKind: element.nativeControlKind,
    interactiveRole: element.interactiveRole,
    rendered: element.renderState === "rendered",
    enabled: element.enabled,
    pointerOperable: element.pointerOperable,
    duplicateContractAttributes: [],
  }));
}

function historicalSemanticElements(html: string): SemanticElement[] {
  const interactiveRoles = new Set(["button", "link", "tab", "menuitem", "checkbox", "radio", "switch"]);
  return parseStitchSemanticDomV1(html).map((element, index) => {
    const nativeControlKind: SemanticElement["nativeControlKind"] = element.tagName === "a"
      ? "link"
      : ["button", "input", "textarea", "select"].includes(element.tagName)
        ? element.tagName as Exclude<SemanticElement["nativeControlKind"], "link" | null>
        : null;
    return {
      elementRef: `S${String(index + 1).padStart(6, "0")}`,
      tagName: element.tagName,
      activeSurfaceRef: element.activeSurfaceRef ?? null,
      ownSurfaceRef: stitchSemanticAttribute(element, "data-surface-id") ?? null,
      dataAction: stitchSemanticAttribute(element, "data-action") ?? null,
      dataActionInput: stitchSemanticAttribute(element, "data-action-input") ?? null,
      role: stitchSemanticAttribute(element, "role") ?? null,
      ariaLabel: stitchSemanticAttribute(element, "aria-label") ?? null,
      href: stitchSemanticAttribute(element, "href") ?? null,
      nativeControlKind,
      interactiveRole: interactiveRoles.has((stitchSemanticAttribute(element, "role") ?? "").toLowerCase()),
      rendered: element.rendered,
      enabled: !element.disabled,
      pointerOperable: element.rendered && !element.disabled,
      duplicateContractAttributes: element.duplicateAttributes,
    };
  });
}

function refsByValue(values: readonly Readonly<{ value: string; elementRef: string }>[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const entry of values) {
    const refs = result.get(entry.value) ?? [];
    refs.push(entry.elementRef);
    result.set(entry.value, refs);
  }
  for (const refs of result.values()) refs.sort(compareUtf16);
  return result;
}

function countDisposition(expectedCount: number, observedCount: number): SemanticCheck["disposition"] {
  if (expectedCount === 0 && observedCount > 0) return "unexpected";
  if (observedCount < expectedCount) return "missing";
  if (observedCount > expectedCount) return "duplicate";
  return "exact";
}

function cardinalityCheck(input: Readonly<{
  kind: SemanticCheck["kind"];
  semanticRef: string;
  expectedCount: number;
  elementRefs: readonly string[];
}>): SemanticCheck {
  const elementRefs = uniqueSorted(input.elementRefs);
  return {
    kind: input.kind,
    semanticRef: input.semanticRef,
    expectedCount: input.expectedCount,
    observedCount: elementRefs.length,
    elementRefs,
    disposition: countDisposition(input.expectedCount, elementRefs.length),
  };
}

function titleCheck(target: DesignGenerationTargetV1, observedTitle: string): SemanticCheck {
  return {
    kind: "screen_title",
    semanticRef: target.targetId,
    expectedValue: target.expectedScreenTitle,
    observedValue: observedTitle,
    expectedCount: 1,
    observedCount: 1,
    elementRefs: [],
    disposition: observedTitle === target.expectedScreenTitle ? "exact" : "mismatch",
  };
}

function semanticChecks(target: DesignGenerationTargetV1, elements: readonly SemanticElement[]): SemanticCheck[] {
  const actionableElements = elements.filter((element) =>
    element.nativeControlKind !== null
    && element.rendered
    && element.enabled
    && element.pointerOperable
    && element.activeSurfaceRef === target.surfaceRef);
  const nonActionableElements = elements.filter((element) =>
    element.rendered && !actionableElements.includes(element));
  const observedActions = refsByValue(actionableElements
    .filter((element) => Boolean(element.dataAction))
    .map((element) => ({ value: element.dataAction!, elementRef: element.elementRef })));
  const misplacedActions = refsByValue(nonActionableElements
    .filter((element) => Boolean(element.dataAction))
    .map((element) => ({ value: element.dataAction!, elementRef: element.elementRef })));
  const observedInputs = refsByValue(actionableElements.flatMap((element) => {
    const value = element.dataActionInput;
    return value === null ? [] : value.split(/[;,\s]+/).filter(Boolean)
      .map((inputRef) => ({ value: inputRef, elementRef: element.elementRef }));
  }));
  const misplacedInputs = refsByValue(nonActionableElements.flatMap((element) => {
    const value = element.dataActionInput;
    return value === null ? [] : value.split(/[;,\s]+/).filter(Boolean)
      .map((inputRef) => ({ value: inputRef, elementRef: element.elementRef }));
  }));
  const observedSurfaces = refsByValue(elements
    .filter((element) => element.rendered && Boolean(element.ownSurfaceRef))
    .map((element) => ({ value: element.ownSurfaceRef!, elementRef: element.elementRef })));

  const checks: SemanticCheck[] = [];
  const expectedActions = new Set(target.requiredActionRefs);
  for (const actionRef of target.requiredActionRefs) {
    checks.push(cardinalityCheck({
      kind: "action",
      semanticRef: actionRef,
      expectedCount: 1,
      elementRefs: observedActions.get(actionRef) ?? [],
    }));
  }
  for (const [actionRef, elementRefs] of observedActions) {
    if (expectedActions.has(actionRef)) continue;
    checks.push(cardinalityCheck({
      kind: "action",
      semanticRef: actionRef || "<empty-data-action>",
      expectedCount: 0,
      elementRefs,
    }));
  }
  for (const [actionRef, elementRefs] of misplacedActions) {
    checks.push(cardinalityCheck({
      kind: "action",
      semanticRef: `${actionRef || "<empty-data-action>"}@non_actionable_element`,
      expectedCount: 0,
      elementRefs,
    }));
  }

  const expectedInputRefs = new Set(target.requiredActionInputs.flatMap((input) =>
    input.inputFields.map((field) => `${input.actionRef}.${field}`)));
  for (const inputRef of expectedInputRefs) {
    checks.push(cardinalityCheck({
      kind: "action_input",
      semanticRef: inputRef,
      expectedCount: 1,
      elementRefs: observedInputs.get(inputRef) ?? [],
    }));
  }
  for (const [inputRef, elementRefs] of observedInputs) {
    if (expectedInputRefs.has(inputRef)) continue;
    checks.push(cardinalityCheck({
      kind: "action_input",
      semanticRef: inputRef || "<empty-data-action-input>",
      expectedCount: 0,
      elementRefs,
    }));
  }
  for (const [inputRef, elementRefs] of misplacedInputs) {
    checks.push(cardinalityCheck({
      kind: "action_input",
      semanticRef: `${inputRef || "<empty-data-action-input>"}@non_actionable_element`,
      expectedCount: 0,
      elementRefs,
    }));
  }

  const duplicateContractAttributes = new Set([
    "data-action", "data-action-input", "data-surface-id", "role", "aria-label", "href",
  ]);
  elements.forEach((element) => {
    if (!element.rendered || element.activeSurfaceRef !== target.surfaceRef) return;
    const actionRef = element.dataAction;
    const inputRefs = (element.dataActionInput ?? "")
      .split(/[;,\s]+/)
      .filter(Boolean);
    const ariaInteractive = element.interactiveRole;
    const nativeInteractive = element.nativeControlKind !== null;
    const declaredControl = nativeInteractive && (
      (Boolean(actionRef) && expectedActions.has(actionRef!))
      || inputRefs.some((inputRef) => expectedInputRefs.has(inputRef))
    );
    if ((nativeInteractive || ariaInteractive) && !declaredControl) {
      checks.push(cardinalityCheck({
        kind: "control",
        semanticRef: `${element.elementRef}@undeclared_control`,
        expectedCount: 0,
        elementRefs: [element.elementRef],
      }));
    }
    for (const attribute of element.duplicateContractAttributes) {
      if (!duplicateContractAttributes.has(attribute)) continue;
      checks.push(cardinalityCheck({
        kind: "control",
        semanticRef: `${element.elementRef}@duplicate_${attribute}`,
        expectedCount: 0,
        elementRefs: [element.elementRef],
      }));
    }
  });

  checks.push(cardinalityCheck({
    kind: "surface",
    semanticRef: target.surfaceRef,
    expectedCount: 1,
    elementRefs: observedSurfaces.get(target.surfaceRef) ?? [],
  }));
  for (const [surfaceRef, elementRefs] of observedSurfaces) {
    if (surfaceRef === target.surfaceRef) continue;
    checks.push(cardinalityCheck({
      kind: "surface",
      semanticRef: surfaceRef || "<empty-data-surface-id>",
      expectedCount: 0,
      elementRefs,
    }));
  }

  for (const observable of target.requiredObservableSelectors ?? []) {
    if (observable.selector.kind !== "accessibility") continue;
    const selector = observable.selector;
    const elementRefs = elements.filter((element) =>
      element.rendered
      && element.activeSurfaceRef === selector.surfaceRef
      && element.role === selector.role
      && element.ariaLabel === selector.name).map((element) => element.elementRef);
    checks.push(cardinalityCheck({
      kind: "accessibility",
      semanticRef: observable.observableRef,
      expectedCount: 1,
      elementRefs,
    }));
  }

  return checks.sort((left, right) =>
    compareUtf16(left.kind, right.kind) || compareUtf16(left.semanticRef, right.semanticRef));
}

function candidateEvaluation(input: Readonly<{
  target: DesignGenerationTargetV1;
  candidate: StitchCandidateFactV1;
  semanticElements?: readonly SemanticElement[];
  requireDownloadReceipts: boolean;
}>): StitchCandidateEvaluationV1 {
  const title = titleCheck(input.target, input.candidate.title);
  const checks = [
    title,
    ...(input.semanticElements ? semanticChecks(input.target, input.semanticElements) : []),
  ].sort((left, right) => compareUtf16(left.kind, right.kind) || compareUtf16(left.semanticRef, right.semanticRef));
  const rejectionCodes: StitchCandidateEvaluationV1["rejectionCodes"][number][] = [];
  if (!safeScreenId(input.candidate.screenId)) rejectionCodes.push("CANDIDATE_SCREEN_ID_UNSAFE");
  if (input.requireDownloadReceipts && input.candidate.semanticEvidenceStatus !== "browser_rendered") {
    rejectionCodes.push(input.candidate.semanticEvidenceStatus === "browser_source_rejected"
      ? "CANDIDATE_RENDERED_SEMANTICS_SOURCE_REJECTED"
      : "CANDIDATE_RENDERED_SEMANTICS_MISSING");
  }
  if (input.candidate.renderDisposition !== "admitted_renderable_screen") {
    rejectionCodes.push("CANDIDATE_RENDER_EVIDENCE_INCOMPLETE");
  }
  if (input.candidate.renderDisposition === "excluded_identity_conflict") {
    rejectionCodes.push("CANDIDATE_RESPONSE_IDENTITY_CONFLICT");
  }
  if (input.candidate.htmlArtifactValidity === "missing") rejectionCodes.push("CANDIDATE_LOCAL_HTML_MISSING");
  if (input.candidate.htmlArtifactValidity === "invalid") rejectionCodes.push("CANDIDATE_LOCAL_HTML_INVALID");
  if (input.candidate.htmlArtifactValidity === "unexpected") rejectionCodes.push("CANDIDATE_LOCAL_HTML_UNEXPECTED");
  if (input.candidate.screenshotArtifactValidity === "missing") rejectionCodes.push("CANDIDATE_LOCAL_SCREENSHOT_MISSING");
  if (input.candidate.screenshotArtifactValidity === "invalid") rejectionCodes.push("CANDIDATE_LOCAL_SCREENSHOT_INVALID");
  if (input.candidate.screenshotArtifactValidity === "unexpected") rejectionCodes.push("CANDIDATE_LOCAL_SCREENSHOT_UNEXPECTED");
  if (input.requireDownloadReceipts) {
    if (
      !input.candidate.htmlSourceRefHash
      || !input.candidate.screenshotSourceRefHash
      || !input.candidate.htmlDownloadedArtifactHash
      || !input.candidate.screenshotDownloadedArtifactHash
    ) {
      rejectionCodes.push("CANDIDATE_DOWNLOAD_RECEIPT_MISSING");
    } else if (
      input.candidate.htmlDownloadedArtifactHash !== input.candidate.htmlArtifactHash
      || input.candidate.screenshotDownloadedArtifactHash !== input.candidate.screenshotArtifactHash
    ) {
      rejectionCodes.push("CANDIDATE_DOWNLOAD_RECEIPT_MISMATCH");
    }
  }
  if (title.disposition !== "exact") rejectionCodes.push("CANDIDATE_TITLE_MISMATCH");
  if (checks.some((check) => check.kind === "action" && check.disposition !== "exact")) {
    rejectionCodes.push("CANDIDATE_ACTION_SET_MISMATCH");
  }
  if (checks.some((check) => check.kind === "action_input" && check.disposition !== "exact")) {
    rejectionCodes.push("CANDIDATE_ACTION_INPUT_SET_MISMATCH");
  }
  if (checks.some((check) => check.kind === "surface" && check.disposition !== "exact")) {
    rejectionCodes.push("CANDIDATE_SURFACE_SELECTOR_MISMATCH");
  }
  if (checks.some((check) => check.kind === "accessibility" && check.disposition !== "exact")) {
    rejectionCodes.push("CANDIDATE_ACCESSIBILITY_SELECTOR_MISMATCH");
  }
  if (checks.some((check) => check.kind === "control" && check.disposition !== "exact")) {
    rejectionCodes.push("CANDIDATE_CONTROL_SET_MISMATCH");
  }

  let qualificationTier: StitchCandidateEvaluationV1["qualificationTier"];
  if (input.candidate.renderDisposition === "excluded_identity_conflict") {
    qualificationTier = "excluded_response_identity_conflict";
  } else if (input.candidate.renderDisposition !== "admitted_renderable_screen") {
    qualificationTier = "excluded_missing_render_evidence";
  } else if (
    input.candidate.htmlArtifactValidity !== "valid"
    || input.candidate.screenshotArtifactValidity !== "valid"
    || (input.requireDownloadReceipts && rejectionCodes.some((code) => code.startsWith("CANDIDATE_DOWNLOAD_RECEIPT_")))
  ) {
    qualificationTier = "excluded_missing_local_artifact";
  } else if (
    !safeScreenId(input.candidate.screenId)
    || (input.requireDownloadReceipts && input.candidate.semanticEvidenceStatus !== "browser_rendered")
    || !input.semanticElements
  ) {
    qualificationTier = "excluded_missing_render_evidence";
  } else if (title.disposition !== "exact") {
    qualificationTier = "renderable_stage_candidate";
  } else if (checks.every((check) => check.disposition === "exact")) {
    qualificationTier = "exact_target_semantics";
  } else {
    qualificationTier = "exact_title_incomplete_semantics";
  }
  return {
    screenId: input.candidate.screenId,
    qualificationTier,
    rejectionCodes: uniqueSorted(rejectionCodes) as StitchCandidateEvaluationV1["rejectionCodes"],
    semanticChecks: checks,
  };
}

/**
 * Evaluates every direct candidate owned by a target's exact batch. The
 * producer never drops provider variants and never delegates a selection to
 * the converter, story projection, or setup packet consumer.
 */
export function selectStitchTargetCandidatesV1(input: Readonly<{
  generationTargets: unknown;
  directResponseEvidence: unknown;
  renderedSemantics?: unknown;
  artifacts: readonly StitchCandidateArtifactBytesV1[];
  authorityMode: "clean_v3" | "historical_read";
}>): StitchCandidateSelectionResultV1 {
  const targetsResult = DesignGenerationTargetsV1Schema.safeParse(input.generationTargets);
  if (!targetsResult.success) {
    return reject(targetsResult.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_CANDIDATE_TARGET_INPUT_INVALID",
      `Generation targets failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  const evidenceResult = parseStitchDirectResponseEvidence(input.directResponseEvidence);
  if (evidenceResult.status === "rejected") {
    return reject(evidenceResult.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_CANDIDATE_DIRECT_EVIDENCE_INVALID",
      `Direct response evidence failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  if (input.authorityMode === "clean_v3" && evidenceResult.sourceVersion !== "v2") {
    return reject([diagnostic(
      "DESIGN_CANDIDATE_DIRECT_EVIDENCE_VERSION_UNSUPPORTED",
      "Clean Product Compiler v3 selection requires direct response evidence v2 with identity conflicts and attempt-bound download receipts",
      evidenceResult.sourceVersion,
    )]);
  }
  const generationTargets = targetsResult.data;
  const directResponseEvidence = evidenceResult.normalized;
  const requireDownloadReceipts = input.authorityMode === "clean_v3";
  let renderedSemantics: StitchRenderedSemanticsV1 | undefined;
  if (requireDownloadReceipts) {
    if (input.renderedSemantics === undefined) {
      return reject([diagnostic(
        "DESIGN_CANDIDATE_RENDERED_SEMANTICS_REQUIRED",
        "Clean Product Compiler v3 selection requires sealed browser-rendered semantics",
        "stitch/STITCH_RENDERED_SEMANTICS.json",
      )]);
    }
    const renderedResult = StitchRenderedSemanticsV1Schema.safeParse(input.renderedSemantics);
    if (!renderedResult.success) {
      return reject(renderedResult.error.issues.slice(0, 100).map((issue) => diagnostic(
        "DESIGN_CANDIDATE_RENDERED_SEMANTICS_INVALID",
        `Rendered semantics failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
        issue.path.join("/") || "$",
      )));
    }
    renderedSemantics = renderedResult.data;
    if (
      renderedSemantics.generationTargetsHash !== hashCanonicalJson(generationTargets)
      || renderedSemantics.directResponseEvidenceHash !== hashCanonicalJson(evidenceResult.source)
    ) {
      return reject([diagnostic(
        "DESIGN_CANDIDATE_RENDERED_SEMANTICS_CHAIN_MISMATCH",
        "Rendered semantics do not reference the exact generation-target and direct-evidence bytes",
        hashCanonicalJson(renderedSemantics),
      )]);
    }
  }
  const diagnostics: CompilationDiagnosticV1[] = [];
  const targetById = new Map(generationTargets.targets.map((target) => [target.targetId, target]));
  const stageByTarget = new Map<string, typeof directResponseEvidence.batches[number]>();
  for (const batch of directResponseEvidence.batches) {
    for (const targetRef of batch.targetRefs) {
      if (!targetById.has(targetRef)) {
        diagnostics.push(diagnostic(
          "DESIGN_CANDIDATE_TARGET_UNRESOLVED",
          `Direct response batch ${batch.stageId} owns absent target ${targetRef}`,
          targetRef,
        ));
      }
      if (stageByTarget.has(targetRef)) {
        diagnostics.push(diagnostic(
          "DESIGN_CANDIDATE_TARGET_DUPLICATE",
          `Target ${targetRef} is owned by more than one direct response batch`,
          targetRef,
        ));
      }
      stageByTarget.set(targetRef, batch);
    }
  }
  for (const target of generationTargets.targets) {
    if (!stageByTarget.has(target.targetId)) {
      diagnostics.push(diagnostic(
        "DESIGN_CANDIDATE_TARGET_MISSING",
        `Generation target ${target.targetId} has no direct response batch`,
        target.targetId,
      ));
    }
  }
  const artifactByScreenId = new Map<string, StitchCandidateArtifactBytesV1>();
  const knownScreenIds = new Set(directResponseEvidence.batches.flatMap((batch) =>
    batch.candidates.map((candidate) => candidate.screenId)));
  for (const artifact of input.artifacts) {
    if (artifactByScreenId.has(artifact.screenId)) {
      diagnostics.push(diagnostic(
        "DESIGN_CANDIDATE_ARTIFACT_DUPLICATE",
        `Candidate artifacts repeat screen ${artifact.screenId}`,
        artifact.screenId,
      ));
    }
    if (!knownScreenIds.has(artifact.screenId)) {
      diagnostics.push(diagnostic(
        "DESIGN_CANDIDATE_ARTIFACT_UNEXPECTED",
        `Local candidate artifact is absent from direct response evidence: ${artifact.screenId}`,
        artifact.screenId,
      ));
    }
    artifactByScreenId.set(artifact.screenId, artifact);
  }
  const renderedByScreenId = new Map(
    renderedSemantics?.candidates.map((candidate) => [candidate.screenId, candidate] as const) ?? [],
  );
  if (renderedSemantics) {
    const expectedScreenIds = [...knownScreenIds].sort(compareUtf16);
    const renderedScreenIds = [...renderedByScreenId.keys()].sort(compareUtf16);
    if (JSON.stringify(expectedScreenIds) !== JSON.stringify(renderedScreenIds)) {
      diagnostics.push(diagnostic(
        "DESIGN_CANDIDATE_RENDERED_SEMANTICS_CARDINALITY_MISMATCH",
        "Rendered semantics must preserve every direct response candidate exactly once",
      ));
    }
    for (const batch of directResponseEvidence.batches) {
      for (const candidate of batch.candidates) {
        if (renderedByScreenId.get(candidate.screenId)?.stageId !== batch.stageId) {
          diagnostics.push(diagnostic(
            "DESIGN_CANDIDATE_RENDERED_SEMANTICS_STAGE_MISMATCH",
            `Rendered semantics changed the owning stage for ${candidate.screenId}`,
            candidate.screenId,
          ));
        }
      }
    }
  }
  if (diagnostics.length > 0) return reject(diagnostics);

  const semanticElementsByScreenId = new Map<string, SemanticElement[]>();
  const candidates: StitchCandidateFactV1[] = directResponseEvidence.batches.flatMap((batch) =>
    batch.candidates.map((candidate) => {
      const artifact = artifactByScreenId.get(candidate.screenId);
      const htmlBytes = artifact?.htmlBytes?.byteLength ? artifact.htmlBytes : undefined;
      const screenshotBytes = artifact?.screenshotBytes?.byteLength ? artifact.screenshotBytes : undefined;
      const htmlArtifactValidity = !htmlBytes
        ? "missing" as const
        : !candidate.htmlAvailable
          ? "unexpected" as const
          : isValidStitchHtmlBytes(htmlBytes)
            ? "valid" as const
            : "invalid" as const;
      const screenshotArtifactValidity = !screenshotBytes
        ? "missing" as const
        : !candidate.screenshotAvailable
          ? "unexpected" as const
          : isValidStitchScreenshotBytes(screenshotBytes)
            ? "valid" as const
            : "invalid" as const;
      const renderedCandidate = renderedByScreenId.get(candidate.screenId);
      if (renderedCandidate?.status === "rendered") {
        semanticElementsByScreenId.set(candidate.screenId, browserSemanticElements(renderedCandidate.elements));
      } else if (!requireDownloadReceipts && htmlArtifactValidity === "valid") {
        semanticElementsByScreenId.set(
          candidate.screenId,
          historicalSemanticElements(Buffer.from(htmlBytes!).toString("utf8")),
        );
      }
      return {
        stageId: batch.stageId,
        targetRefs: [...batch.targetRefs].sort(compareUtf16),
        screenId: candidate.screenId,
        title: candidate.title,
        responsePaths: [...candidate.responsePaths].sort(compareUtf16),
        renderDisposition: candidate.disposition,
        identityConflicts: candidate.identityConflicts,
        missingEvidence: candidate.missingEvidence,
        htmlSourceRefHash: candidate.htmlSourceRefHash,
        screenshotSourceRefHash: candidate.screenshotSourceRefHash,
        htmlDownloadedArtifactHash: candidate.htmlDownloadedArtifactHash,
        screenshotDownloadedArtifactHash: candidate.screenshotDownloadedArtifactHash,
        htmlArtifactHash: htmlBytes ? sha256(htmlBytes) : null,
        screenshotArtifactHash: screenshotBytes ? sha256(screenshotBytes) : null,
        htmlArtifactValidity,
        screenshotArtifactValidity,
        semanticEvidenceStatus: requireDownloadReceipts
          ? renderedCandidate?.status === "rendered"
            ? "browser_rendered" as const
            : "browser_source_rejected" as const
          : "historical_static" as const,
        semanticDomHash: renderedCandidate?.semanticDom?.hash ?? null,
        semanticObservationHash: renderedCandidate?.observationHash ?? null,
        semanticFailureCodes: renderedCandidate?.failureCodes ?? [],
      };
    })).sort((left, right) => compareUtf16(left.stageId, right.stageId) || compareUtf16(left.screenId, right.screenId));
  if (renderedSemantics) {
    for (const candidate of candidates) {
      const rendered = renderedByScreenId.get(candidate.screenId);
      if (
        !rendered
        || rendered.htmlArtifactHash !== candidate.htmlArtifactHash
        || rendered.screenshotArtifactHash !== candidate.screenshotArtifactHash
      ) {
        diagnostics.push(diagnostic(
          "DESIGN_CANDIDATE_RENDERED_SEMANTICS_ARTIFACT_MISMATCH",
          `Rendered semantics do not attest the current local artifacts for ${candidate.screenId}`,
          candidate.screenId,
        ));
      }
    }
  }
  if (diagnostics.length > 0) return reject(diagnostics);
  const candidateById = new Map(candidates.map((candidate) => [candidate.screenId, candidate]));

  const selections = generationTargets.targets.map((target) => {
    const stage = stageByTarget.get(target.targetId)!;
    const stageCandidates = stage.candidates
      .map((candidate) => candidateById.get(candidate.screenId)!)
      .sort((left, right) => compareUtf16(left.screenId, right.screenId));
    const evaluations = stageCandidates.map((candidate) => candidateEvaluation({
      target,
      candidate,
      semanticElements: semanticElementsByScreenId.get(candidate.screenId),
      requireDownloadReceipts,
    }));
    const rankedQualifiedScreenIds = evaluations
      .filter((evaluation) => evaluation.qualificationTier === "exact_target_semantics")
      .map((evaluation) => candidateById.get(evaluation.screenId)!)
      .sort((left, right) =>
        compareUtf16(left.htmlArtifactHash ?? "", right.htmlArtifactHash ?? "")
        || compareUtf16(left.screenshotArtifactHash ?? "", right.screenshotArtifactHash ?? "")
        || compareUtf16(left.screenId, right.screenId))
      .map((candidate) => candidate.screenId);
    return {
      targetRef: target.targetId,
      stageId: stage.stageId,
      evaluations,
      rankedQualifiedScreenIds,
      status: rankedQualifiedScreenIds.length > 0 ? "selected" as const : "unresolved" as const,
      selectedScreenId: rankedQualifiedScreenIds[0] ?? null,
    };
  }).sort((left, right) => compareUtf16(left.targetRef, right.targetRef));

  const selectionResult = StitchTargetCandidateSelectionV1Schema.safeParse({
    schema: "setfarm.stitch-target-candidate-selection.v1",
    generationTargetsHash: hashCanonicalJson(generationTargets),
    directResponseEvidenceHash: hashCanonicalJson(evidenceResult.source),
    semanticEvidencePolicy: requireDownloadReceipts ? "browser_rendered_v1" : "historical_static_v1",
    renderedSemanticsHash: renderedSemantics ? hashCanonicalJson(renderedSemantics) : null,
    policy: STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V1,
    downloadReceiptPolicy: requireDownloadReceipts ? "required" : "historical_unverified",
    candidates,
    selections,
  });
  if (!selectionResult.success) {
    return reject(selectionResult.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_CANDIDATE_SELECTION_OUTPUT_INVALID",
      `Candidate selection failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  const candidateSelection = selectionResult.data;
  const unresolved = candidateSelection.selections.filter((selection) => selection.status === "unresolved");
  if (unresolved.length > 0) {
    const candidateSelectionFailure = produceStitchTargetCandidateSelectionFailureV1(candidateSelection);
    return reject(unresolved.map((selection) => diagnostic(
      "DESIGN_CANDIDATE_SELECTION_UNRESOLVED",
      `Target ${selection.targetRef} has no direct candidate with exact target semantics and complete local render evidence`,
      selection.targetRef,
    )), candidateSelection, candidateSelectionFailure);
  }
  return { status: "produced", candidateSelection, diagnostics: [] };
}

/** Creates the sole downstream mapping from the already selected authority. */
export function bindStitchTargetCandidateSelectionsV2(input: Readonly<{
  generationTargets: unknown;
  candidateSelection: unknown;
}>): StitchTargetBindingResultV2 {
  const targetsResult = DesignGenerationTargetsV1Schema.safeParse(input.generationTargets);
  const selectionResult = StitchTargetCandidateSelectionV1Schema.safeParse(input.candidateSelection);
  const diagnostics: CompilationDiagnosticV1[] = [];
  if (!targetsResult.success) {
    diagnostics.push(...targetsResult.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_BINDING_V2_TARGET_INPUT_INVALID",
      `Generation targets failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  if (!selectionResult.success) {
    diagnostics.push(...selectionResult.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_BINDING_V2_SELECTION_INPUT_INVALID",
      `Candidate selection failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  if (diagnostics.length > 0 || !targetsResult.success || !selectionResult.success) return reject(diagnostics);
  const generationTargets = targetsResult.data;
  const candidateSelection = selectionResult.data;
  if (
    candidateSelection.downloadReceiptPolicy !== "required"
    || candidateSelection.semanticEvidencePolicy !== "browser_rendered_v1"
    || !candidateSelection.renderedSemanticsHash
  ) {
    return reject([diagnostic(
      "DESIGN_BINDING_V2_HISTORICAL_AUTHORITY_REJECTED",
      "Response bindings v2 require clean-v3 candidate authority with verified download receipts",
      candidateSelection.semanticEvidencePolicy,
    )], candidateSelection);
  }
  if (candidateSelection.generationTargetsHash !== hashCanonicalJson(generationTargets)) {
    return reject([diagnostic(
      "DESIGN_BINDING_V2_TARGET_HASH_MISMATCH",
      "Candidate selection does not reference the exact generation target bytes",
      candidateSelection.generationTargetsHash,
    )]);
  }
  const selectionByTarget = new Map(candidateSelection.selections.map((selection) => [selection.targetRef, selection]));
  const candidateById = new Map(candidateSelection.candidates.map((candidate) => [candidate.screenId, candidate]));
  const bindings: StitchTargetResponseBindingsV2["bindings"] = [];
  for (const target of generationTargets.targets) {
    const selection = selectionByTarget.get(target.targetId);
    const candidate = selection?.selectedScreenId
      ? candidateById.get(selection.selectedScreenId)
      : undefined;
    const selectedEvaluation = selection?.selectedScreenId
      ? selection.evaluations.find((evaluation) => evaluation.screenId === selection.selectedScreenId)
      : undefined;
    const contractElementRefs = uniqueSorted(selectedEvaluation?.semanticChecks
      .filter((check) => check.kind !== "screen_title" && check.disposition === "exact")
      .flatMap((check) => check.elementRefs) ?? []);
    if (
      !selection
      || selection.status !== "selected"
      || !candidate
      || !candidate.htmlArtifactHash
      || !candidate.screenshotArtifactHash
      || !candidate.semanticDomHash
      || !candidate.semanticObservationHash
      || candidate.semanticEvidenceStatus !== "browser_rendered"
      || !selectedEvaluation
      || selectedEvaluation.qualificationTier !== "exact_target_semantics"
      || contractElementRefs.length === 0
      || candidate.htmlArtifactValidity !== "valid"
      || candidate.screenshotArtifactValidity !== "valid"
      || candidate.title !== target.expectedScreenTitle
      || candidate.stageId !== selection.stageId
    ) {
      diagnostics.push(diagnostic(
        "DESIGN_BINDING_V2_SELECTION_UNRESOLVED",
        `Target ${target.targetId} has no valid selected candidate authority`,
        target.targetId,
      ));
      continue;
    }
    bindings.push({
      targetRef: target.targetId,
      requestScreenKey: target.requestScreenKey,
      expectedScreenTitle: target.expectedScreenTitle,
      responseScreenId: candidate.screenId,
      responseTitle: candidate.title,
      stageId: candidate.stageId,
      htmlArtifactHash: candidate.htmlArtifactHash,
      screenshotArtifactHash: candidate.screenshotArtifactHash,
      semanticDomHash: candidate.semanticDomHash,
      semanticObservationHash: candidate.semanticObservationHash,
      contractElementRefs,
    });
  }
  if (bindings.length !== candidateSelection.selections.length) {
    diagnostics.push(diagnostic(
      "DESIGN_BINDING_V2_SELECTION_CARDINALITY_MISMATCH",
      "Every target selection must produce exactly one response binding",
    ));
  }
  if (diagnostics.length > 0) return reject(diagnostics, candidateSelection);
  const bindingsResult = StitchTargetResponseBindingsV2Schema.safeParse({
    schema: "setfarm.stitch-target-response-bindings.v2",
    generationTargetsHash: hashCanonicalJson(generationTargets),
    candidateSelectionHash: hashCanonicalJson(candidateSelection),
    renderedSemanticsHash: candidateSelection.renderedSemanticsHash,
    bindings: bindings.sort((left, right) => compareUtf16(left.targetRef, right.targetRef)),
  });
  if (!bindingsResult.success) {
    return reject(bindingsResult.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_BINDING_V2_OUTPUT_INVALID",
      `Selected response bindings failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )), candidateSelection);
  }
  return { status: "produced", responseBindings: bindingsResult.data, diagnostics: [] };
}
