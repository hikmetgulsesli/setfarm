#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const repoPath = process.argv[2];
if (!repoPath) { console.error("Usage: node stitch-to-jsx.mjs <repo-path>"); process.exit(1); }

const stitchDir = path.join(repoPath, "stitch");
const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
if (!fs.existsSync(manifestPath)) { console.log("No DESIGN_MANIFEST.json — skipping"); process.exit(0); }

const conversionResultPath = path.join(repoPath, ".setfarm", "setup", "STITCH_TO_JSX_RESULT.json");
try { fs.rmSync(conversionResultPath, { force: true }); } catch {}

class StitchConversionContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StitchConversionContractError";
    this.code = code;
  }
}

function failConversion(code, message) {
  throw new StitchConversionContractError(code, message);
}

function writeConversionResult(result) {
  fs.mkdirSync(path.dirname(conversionResultPath), { recursive: true });
  fs.writeFileSync(conversionResultPath, `${JSON.stringify({
    schema: "setfarm.stitch-to-jsx-result.v1",
    ...result,
  }, null, 2)}\n`);
}

process.on("uncaughtException", (error) => {
  if (error instanceof StitchConversionContractError) {
    writeConversionResult({ status: "failed", failureCode: error.code });
    console.error(`${error.code}:${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

let rawManifest;
try {
  rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
} catch {
  failConversion(
    "STITCH_DESIGN_MANIFEST_JSON_INVALID",
    "DESIGN_MANIFEST.json must contain valid JSON",
  );
}
const screensDir = path.join(repoPath, "src", "screens");
fs.mkdirSync(screensDir, { recursive: true });
const MIN_STITCH_HTML_BYTES = 1000;

function manifestScreens(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.screens)) return value.screens;
  if (value?.screens && typeof value.screens === "object") return Object.values(value.screens);
  return [];
}

function isPrdPseudoScreen(screen) {
  const title = String(screen?.title || screen?.name || "").trim().toLowerCase();
  const htmlFile = String(screen?.htmlFile || "").trim().toLowerCase();
  const screenId = String(screen?.screenId || screen?.id || "").trim().toLowerCase();
  return /\b(?:prd|requirements?)\b/.test(`${screenId} ${title} ${htmlFile}`);
}

function isValidStitchHtml(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    if (fs.statSync(filePath).size < MIN_STITCH_HTML_BYTES) return false;
    const head = fs.readFileSync(filePath, "utf-8").slice(0, 4000).toLowerCase();
    if (!head.includes("<html") && !head.includes("<!doctype")) return false;
    if (head.includes("empty html") || head.includes("design not generated")) return false;
    return true;
  } catch {
    return false;
  }
}

function findScreenHtml(screen) {
  const candidates = [
    screen?.htmlFile,
    screen?.screenId ? `${screen.screenId}.html` : "",
  ].filter(Boolean);
  return candidates.map(file => path.join(stitchDir, file)).find(isValidStitchHtml);
}

function fallbackManifestFromScreenMap() {
  const screenMapPath = path.join(stitchDir, "SCREEN_MAP.json");
  if (!fs.existsSync(screenMapPath)) return [];
  let screenMap = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(screenMapPath, "utf-8"));
    screenMap = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
  return screenMap
    .map((screen) => {
      const screenId = String(screen?.screenId || screen?.id || "").trim();
      if (!screenId) return null;
      const htmlFile = `${screenId}.html`;
      if (!isValidStitchHtml(path.join(stitchDir, htmlFile))) return null;
      return {
        screenId,
        title: String(screen?.title || screen?.name || screenId).trim(),
        htmlFile,
        surfaceIds: Array.isArray(screen?.surfaceIds) ? screen.surfaceIds : [],
        type: screen?.type || "",
      };
    })
    .filter(Boolean);
}

function canonicalJsonStringify(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) failConversion("V3_PROJECTION_CONTRACT_JSON_INVALID", "projection contract contains a non-finite number");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(value[key])}`).join(",")}}`;
  }
  failConversion("V3_PROJECTION_CONTRACT_JSON_INVALID", "projection contract contains a non-JSON value");
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Canonical(value) {
  return sha256Bytes(canonicalJsonStringify(value));
}

function exactRepoLocator(locator, expectedPrefix) {
  const value = String(locator || "");
  if (
    !value
    || value.includes("\\")
    || value.startsWith("/")
    || path.posix.normalize(value) !== value
    || !value.startsWith(expectedPrefix)
  ) {
    failConversion("V3_RENDERED_SEMANTIC_DOM_LOCATOR_INVALID", "rendered semantic DOM locator is unsafe or outside its canonical namespace");
  }
  const resolved = path.resolve(repoPath, ...value.split("/"));
  const root = path.resolve(repoPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    failConversion("V3_RENDERED_SEMANTIC_DOM_LOCATOR_INVALID", "rendered semantic DOM locator escapes the generated repository");
  }
  return resolved;
}

function sameSortedStrings(left, right) {
  const normalize = (values) => [...new Set(Array.isArray(values) ? values : [])].sort();
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function exactUniqueMap(values, keyOf, failureCode, label) {
  if (!Array.isArray(values)) failConversion(failureCode, `${label} must be an array`);
  const result = new Map();
  for (const value of values) {
    const key = keyOf(value);
    if (!key || result.has(key)) {
      failConversion(failureCode, `${label} identity is missing or duplicated`);
    }
    result.set(key, value);
  }
  return result;
}

function sameExactSortedStrings(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function exactRenderedElement(renderedElementByRef, elementRef, elementHash, reference) {
  const element = renderedElementByRef.get(elementRef);
  if (!element || sha256Canonical(element) !== elementHash) {
    failConversion(
      "V2_PROJECTION_RENDERED_ELEMENT_MISMATCH",
      `${reference} lost its exact browser-rendered element ref/hash authority`,
    );
  }
  return element;
}

function exactGraphElementSource(source, authority) {
  return Boolean(
    source
    && authority
    && source.targetRef === authority.targetRef
    && source.responseScreenId === authority.responseScreenId
    && source.sourceHash === authority.sourceHash
    && source.htmlArtifactHash === authority.htmlArtifactHash
    && source.screenshotArtifactHash === authority.screenshotArtifactHash
    && source.semanticDomHash === authority.semanticDomHash
    && source.semanticObservationHash === authority.semanticObservationHash
  );
}

function loadNativeV2ProjectionContract({ targets, bindings, selection, renderedSemantics, designGraph }) {
  if (targets?.schema !== "setfarm.design-generation-targets.v2" || !Array.isArray(targets.targets)) {
    failConversion("V2_PROJECTION_TARGETS_INVALID", "native v2 generation targets are required");
  }
  if (bindings?.schema !== "setfarm.stitch-target-response-bindings.v3" || !Array.isArray(bindings.bindings)) {
    failConversion("V2_PROJECTION_BINDINGS_INVALID", "native response bindings v3 are required");
  }
  if (selection?.schema !== "setfarm.stitch-target-candidate-selection.v2" || !Array.isArray(selection.selections) || !Array.isArray(selection.candidates)) {
    failConversion("V2_PROJECTION_SELECTION_INVALID", "native candidate selection v2 is required");
  }
  if (renderedSemantics?.schema !== "setfarm.stitch-rendered-semantics.v2" || !Array.isArray(renderedSemantics.candidates)) {
    failConversion("V2_PROJECTION_RENDERED_SEMANTICS_INVALID", "native browser-rendered semantics v2 are required");
  }
  if (
    designGraph?.schema !== "setfarm.design-interaction-graph.v2"
    || !Array.isArray(designGraph.sourceAuthorities)
    || !Array.isArray(designGraph.surfaces)
    || !Array.isArray(designGraph.actions)
    || !Array.isArray(designGraph.controls)
    || !Array.isArray(designGraph.observables)
  ) {
    failConversion("V2_PROJECTION_DESIGN_GRAPH_INVALID", "native DesignInteractionGraph v2 is required");
  }

  const targetsHash = sha256Canonical(targets);
  const renderedSemanticsHash = sha256Canonical(renderedSemantics);
  const candidateSelectionHash = sha256Canonical(selection);
  const responseBindingsHash = sha256Canonical(bindings);
  if (
    targets.productSpecHash !== designGraph.productSpecHash
    || renderedSemantics.generationTargetsHash !== targetsHash
    || selection.generationTargetsHash !== targetsHash
    || bindings.generationTargetsHash !== targetsHash
    || designGraph.generationTargetsHash !== targetsHash
    || selection.renderedSemanticsHash !== renderedSemanticsHash
    || bindings.renderedSemanticsHash !== renderedSemanticsHash
    || designGraph.renderedSemanticsHash !== renderedSemanticsHash
    || bindings.candidateSelectionHash !== candidateSelectionHash
    || designGraph.candidateSelectionHash !== candidateSelectionHash
    || designGraph.responseBindingsHash !== responseBindingsHash
    || renderedSemantics.directResponseEvidenceHash !== selection.directResponseEvidenceHash
    || selection.directResponseEvidenceHash !== bindings.directResponseEvidenceHash
  ) {
    failConversion(
      "V2_PROJECTION_AUTHORITY_CHAIN_MISMATCH",
      "targets, rendered semantics, selection, response bindings, and design graph do not form one canonical v2 hash chain",
    );
  }

  const targetById = exactUniqueMap(targets.targets, (value) => value?.targetId, "V2_PROJECTION_TARGETS_INVALID", "generation targets");
  const bindingByTarget = exactUniqueMap(bindings.bindings, (value) => value?.targetRef, "V2_PROJECTION_BINDINGS_INVALID", "response bindings");
  const selectionByTarget = exactUniqueMap(selection.selections, (value) => value?.targetRef, "V2_PROJECTION_SELECTION_INVALID", "target selections");
  const candidateByScreen = exactUniqueMap(selection.candidates, (value) => value?.screenId, "V2_PROJECTION_SELECTION_INVALID", "candidate facts");
  const renderedByScreen = exactUniqueMap(renderedSemantics.candidates, (value) => value?.screenId, "V2_PROJECTION_RENDERED_SEMANTICS_INVALID", "rendered candidates");
  const sourceByTarget = exactUniqueMap(designGraph.sourceAuthorities, (value) => value?.targetRef, "V2_PROJECTION_DESIGN_GRAPH_INVALID", "graph source authorities");
  const graphSurfaceByRef = exactUniqueMap(designGraph.surfaces, (value) => value?.surfaceRef, "V2_PROJECTION_DESIGN_GRAPH_INVALID", "graph surfaces");
  const graphActionByRef = exactUniqueMap(designGraph.actions, (value) => value?.actionRef, "V2_PROJECTION_DESIGN_GRAPH_INVALID", "graph actions");
  const graphControlBySlot = exactUniqueMap(designGraph.controls, (value) => value?.identity?.controlSlotRef, "V2_PROJECTION_DESIGN_GRAPH_INVALID", "graph physical controls");
  const graphObservableByRef = exactUniqueMap(designGraph.observables, (value) => value?.observableRef, "V2_PROJECTION_DESIGN_GRAPH_INVALID", "graph observables");
  if (
    bindingByTarget.size !== targetById.size
    || selectionByTarget.size !== targetById.size
    || sourceByTarget.size !== targetById.size
  ) {
    failConversion("V2_PROJECTION_AUTHORITY_CHAIN_MISMATCH", "every v2 target requires one binding, selection, and graph source authority");
  }
  const expectedSurfaceRefs = targets.targets.flatMap((target) => [target.surfaceRef, ...(target.containedSurfaceRefs || [])]);
  const expectedControlSlotRefs = targets.targets.flatMap((target) =>
    (target.requiredControlPlacements || []).map((placement) => placement.controlSlotRef));
  const expectedObservableRefs = targets.targets.flatMap((target) =>
    (target.requiredObservableSelectors || []).map((observable) => observable.observableRef));
  if (
    !sameExactSortedStrings([...graphSurfaceByRef.keys()], expectedSurfaceRefs)
    || !sameExactSortedStrings([...graphControlBySlot.keys()], expectedControlSlotRefs)
    || !sameExactSortedStrings([...graphObservableByRef.keys()], expectedObservableRefs)
  ) {
    failConversion("V2_PROJECTION_DESIGN_GRAPH_INVALID", "design graph surface, physical-control, and observable sets must exactly equal generation authority");
  }
  const expectedRawArtifactHashes = [...new Set(designGraph.sourceAuthorities.flatMap((source) => [
    source.htmlArtifactHash,
    source.screenshotArtifactHash,
  ]))].sort();
  const expectedCardinality = {
    rawArtifacts: expectedRawArtifactHashes.length,
    sourceAuthorities: designGraph.sourceAuthorities.length,
    surfaces: designGraph.surfaces.length,
    actions: designGraph.actions.length,
    userActions: designGraph.actions.filter((action) => action.triggerKind === "user").length,
    controlSlots: designGraph.actions.reduce((total, action) => total + (action.controlSlotRefs?.length || 0), 0),
    physicalControls: designGraph.controls.length,
    actionInputBindings: designGraph.controls.reduce((total, control) => total + (control.actionInputBindings?.length || 0), 0),
    observables: designGraph.observables.length,
  };
  if (
    !sameExactSortedStrings(designGraph.rawArtifactHashes, expectedRawArtifactHashes)
    || sha256Canonical(designGraph.cardinality) !== sha256Canonical(expectedCardinality)
  ) {
    failConversion("V2_PROJECTION_DESIGN_GRAPH_INVALID", "design graph raw artifacts and cardinality do not exactly describe its closed collections");
  }
  for (const action of designGraph.actions) {
    const ownedControls = designGraph.controls.filter((control) =>
      control.identity?.actionRef === action.actionRef);
    const ownedObservables = designGraph.observables.filter((observable) =>
      observable.actionRef === action.actionRef);
    if (
      !sameExactSortedStrings(action.controlSlotRefs, ownedControls.map((control) => control.identity.controlSlotRef))
      || !sameExactSortedStrings(action.controlRefs, ownedControls.map((control) => control.id))
      || !sameExactSortedStrings(action.observableRefs, ownedObservables.map((observable) => observable.observableRef))
      || !Array.isArray(action.affectedSurfaceRefs)
      || action.affectedSurfaceRefs.some((surfaceRef) => !graphSurfaceByRef.has(surfaceRef))
    ) {
      failConversion("V2_PROJECTION_DESIGN_GRAPH_INVALID", `graph action ${action.actionRef} does not exactly index its controls, observables, and affected surfaces`);
    }
  }

  const byScreenId = new Map();
  for (const target of targets.targets) {
    const binding = bindingByTarget.get(target.targetId);
    const selected = selectionByTarget.get(target.targetId);
    const sourceAuthority = sourceByTarget.get(target.targetId);
    if (
      !binding
      || !selected
      || !sourceAuthority
      || binding.targetHash !== sha256Canonical(target)
      || selected.status !== "selected"
      || selected.selectedScreenId !== binding.responseScreenId
      || selected.stageId !== binding.stageId
      || binding.expectedScreenTitle !== target.expectedScreenTitle
      || binding.responseTitle !== target.expectedScreenTitle
      || binding.requestScreenKey !== target.requestScreenKey
      || sourceAuthority.responseScreenId !== binding.responseScreenId
      || sourceAuthority.stageId !== binding.stageId
      || sourceAuthority.targetHash !== binding.targetHash
    ) {
      failConversion("V2_PROJECTION_RESPONSE_BINDING_INVALID", `target ${target.targetId} lost its exact selected response authority`);
    }

    const selectedEvaluation = selected.evaluations?.find((value) => value?.screenId === binding.responseScreenId);
    const candidate = candidateByScreen.get(binding.responseScreenId);
    const rendered = renderedByScreen.get(binding.responseScreenId);
    const graphSourcePayload = { ...sourceAuthority };
    delete graphSourcePayload.sourceHash;
    if (
      selectedEvaluation?.qualificationTier !== "exact_target_semantics"
      || !Array.isArray(selectedEvaluation.semanticChecks)
      || selectedEvaluation.semanticChecks.some((check) => check?.disposition !== "exact")
      || !Array.isArray(selectedEvaluation.rejectionCodes)
      || selectedEvaluation.rejectionCodes.length !== 0
      || !candidate
      || candidate.stageId !== binding.stageId
      || !candidate.targetRefs?.includes(target.targetId)
      || candidate.title !== target.expectedScreenTitle
      || candidate.renderDisposition !== "admitted_renderable_screen"
      || candidate.renderedStatus !== "rendered"
      || candidate.renderedTargetRef !== target.targetId
      || !rendered
      || rendered.status !== "rendered"
      || rendered.stageId !== binding.stageId
      || rendered.targetRef !== target.targetId
      || sourceAuthority.sourceHash !== sha256Canonical(graphSourcePayload)
    ) {
      failConversion("V2_PROJECTION_RESPONSE_BINDING_INVALID", `target ${target.targetId} selection/render/source authority is not exact`);
    }

    const bindingHashFields = [
      "htmlSourceRefHash",
      "screenshotSourceRefHash",
      "htmlDownloadedArtifactHash",
      "screenshotDownloadedArtifactHash",
      "htmlArtifactHash",
      "screenshotArtifactHash",
      "renderedHtmlArtifactHash",
      "renderedScreenshotArtifactHash",
      "semanticDomHash",
      "semanticObservationHash",
      "roleReceiptSetHash",
    ];
    if (bindingHashFields.some((field) => (
      candidate[field] !== binding[field]
      || sourceAuthority[field] !== binding[field]
    ))) {
      failConversion("V2_PROJECTION_RESPONSE_BINDING_INVALID", `target ${target.targetId} source/download/render hashes diverge`);
    }
    if (
      rendered.htmlArtifactHash !== binding.htmlArtifactHash
      || rendered.screenshotArtifactHash !== binding.screenshotArtifactHash
      || rendered.semanticDom?.hash !== binding.semanticDomHash
      || rendered.observationHash !== binding.semanticObservationHash
      || sha256Canonical({ elements: rendered.elements, roleReceipts: rendered.roleReceipts }) !== rendered.observationHash
      || sha256Canonical(rendered.roleReceipts) !== binding.roleReceiptSetHash
    ) {
      failConversion("V2_PROJECTION_RESPONSE_BINDING_INVALID", `target ${target.targetId} rendered observation hashes diverge`);
    }

    const htmlPath = path.join(stitchDir, `${binding.responseScreenId}.html`);
    const screenshotPath = path.join(stitchDir, `${binding.responseScreenId}.png`);
    if (
      !fs.existsSync(htmlPath)
      || !fs.existsSync(screenshotPath)
      || sha256Bytes(fs.readFileSync(htmlPath)) !== binding.htmlArtifactHash
      || sha256Bytes(fs.readFileSync(screenshotPath)) !== binding.screenshotArtifactHash
    ) {
      failConversion("V2_PROJECTION_SELECTED_ARTIFACT_MISMATCH", `target ${target.targetId} selected source bytes do not match response bindings`);
    }
    const semanticDomFile = exactRepoLocator(rendered.semanticDom?.locator, "stitch/rendered-dom-v2/");
    if (!fs.existsSync(semanticDomFile)) {
      failConversion("V2_RENDERED_SEMANTIC_DOM_MISSING", `target ${target.targetId} semantic DOM sidecar is missing`);
    }
    const semanticDomBytes = fs.readFileSync(semanticDomFile);
    if (
      semanticDomBytes.byteLength !== rendered.semanticDom.byteLength
      || sha256Bytes(semanticDomBytes) !== binding.semanticDomHash
    ) {
      failConversion("V2_RENDERED_SEMANTIC_DOM_HASH_MISMATCH", `target ${target.targetId} semantic DOM sidecar bytes differ from browser authority`);
    }
    const renderedElementByRef = exactUniqueMap(rendered.elements, (value) => value?.elementRef, "V2_PROJECTION_RENDERED_ELEMENT_MISMATCH", "rendered elements");

    const expectedSurfaceRefs = [target.surfaceRef, ...(target.containedSurfaceRefs || [])];
    if (!sameExactSortedStrings(binding.surfaceBindings?.map((value) => value.surfaceRef), expectedSurfaceRefs)) {
      failConversion("V2_PROJECTION_SURFACE_BINDING_MISMATCH", `target ${target.targetId} surface bindings are incomplete`);
    }
    for (const surfaceBinding of binding.surfaceBindings) {
      const element = exactRenderedElement(renderedElementByRef, surfaceBinding.elementRef, surfaceBinding.elementHash, `surface ${surfaceBinding.surfaceRef}`);
      const graphSurface = graphSurfaceByRef.get(surfaceBinding.surfaceRef);
      if (
        element.ownSurfaceRef !== surfaceBinding.surfaceRef
        || element.nearestSurfaceRef !== surfaceBinding.surfaceRef
        || !exactGraphElementSource(graphSurface?.source, sourceAuthority)
        || graphSurface?.elementRef !== surfaceBinding.elementRef
        || graphSurface?.elementHash !== surfaceBinding.elementHash
      ) {
        failConversion("V2_PROJECTION_SURFACE_BINDING_MISMATCH", `surface ${surfaceBinding.surfaceRef} does not bind its exact rendered wrapper`);
      }
    }

    const placementBySlot = exactUniqueMap(target.requiredControlPlacements || [], (value) => value?.controlSlotRef, "V2_PROJECTION_CONTROL_BINDING_MISMATCH", "target control placements");
    const responseControlBySlot = exactUniqueMap(binding.controlSlotBindings || [], (value) => value?.controlSlotRef, "V2_PROJECTION_CONTROL_BINDING_MISMATCH", "response control-slot bindings");
    if (placementBySlot.size !== responseControlBySlot.size) {
      failConversion("V2_PROJECTION_CONTROL_BINDING_MISMATCH", `target ${target.targetId} physical control-slot set is incomplete`);
    }
    const controlElementRefs = new Map();
    const controlByElementRef = new Map();
    const actionElementRefs = new Map();
    const expectedActionRefs = new Set();
    const expectedInputPairs = new Set();
    for (const placement of placementBySlot.values()) {
      const responseControl = responseControlBySlot.get(placement.controlSlotRef);
      const graphControl = graphControlBySlot.get(placement.controlSlotRef);
      const graphAction = graphActionByRef.get(placement.actionRef);
      const expectedActionInputRefs = (placement.inputFields || []).map((field) => `${placement.actionRef}.${field}`).sort();
      if (
        !responseControl
        || !graphControl
        || !graphAction
        || responseControl.actionRef !== placement.actionRef
        || responseControl.surfaceRef !== placement.surfaceRef
        || !sameExactSortedStrings(responseControl.actionInputRefs, expectedActionInputRefs)
        || graphControl.identity?.actionRef !== placement.actionRef
        || graphControl.identity?.surfaceRef !== placement.surfaceRef
        || graphControl.dataAction !== placement.actionRef
        || graphControl.dataControlSlot !== placement.controlSlotRef
        || graphControl.elementRef !== responseControl.elementRef
        || graphControl.elementHash !== responseControl.elementHash
        || !exactGraphElementSource(graphControl.source, sourceAuthority)
        || !graphAction.controlSlotRefs?.includes(placement.controlSlotRef)
        || !graphAction.controlRefs?.includes(graphControl.id)
      ) {
        failConversion("V2_PROJECTION_CONTROL_BINDING_MISMATCH", `control slot ${placement.controlSlotRef} lost its exact action/surface/graph binding`);
      }
      const identityPayload = { ...graphControl.identity };
      delete identityPayload.identityHash;
      const identityHash = sha256Canonical(identityPayload);
      const element = exactRenderedElement(renderedElementByRef, responseControl.elementRef, responseControl.elementHash, `control slot ${placement.controlSlotRef}`);
      if (
        graphControl.identity.identityHash !== identityHash
        || graphControl.id !== `CTRL_${identityHash.slice(0, 16)}`
        || element.dataAction !== placement.actionRef
        || element.dataControlSlot !== placement.controlSlotRef
        || graphControl.tagName !== element.tagName
        || graphControl.nativeControlKind !== element.nativeControlKind
        || graphControl.role !== element.role
        || graphControl.ariaLabel !== element.ariaLabel
        || graphControl.href !== element.href
        || graphControl.interactiveRole !== element.interactiveRole
        || element.nearestSurfaceRef !== placement.surfaceRef
        || element.renderState !== "rendered"
        || element.enabled !== true
        || element.pointerOperable !== true
      ) {
        failConversion("V2_PROJECTION_CONTROL_BINDING_MISMATCH", `control slot ${placement.controlSlotRef} is not one exact reachable browser control`);
      }
      const control = {
        controlSlotRef: placement.controlSlotRef,
        actionRef: placement.actionRef,
        surfaceRef: placement.surfaceRef,
        physicalControlRef: graphControl.id,
        affectedSurfaceRefs: Array.isArray(graphAction.affectedSurfaceRefs) ? [...graphAction.affectedSurfaceRefs] : [],
        sourceElementRef: responseControl.elementRef,
        tagName: graphControl.tagName,
        nativeControlKind: graphControl.nativeControlKind,
        role: graphControl.role,
        ariaLabel: graphControl.ariaLabel,
        href: graphControl.href,
        interactiveRole: graphControl.interactiveRole,
      };
      controlElementRefs.set(placement.controlSlotRef, new Set([responseControl.elementRef]));
      if (controlByElementRef.has(responseControl.elementRef)) {
        failConversion("V2_PROJECTION_CONTROL_BINDING_MISMATCH", "one browser element cannot implement multiple physical control slots");
      }
      controlByElementRef.set(responseControl.elementRef, control);
      const refs = actionElementRefs.get(placement.actionRef) || new Set();
      refs.add(responseControl.elementRef);
      actionElementRefs.set(placement.actionRef, refs);
      expectedActionRefs.add(placement.actionRef);
      expectedActionInputRefs.forEach((value) => expectedInputPairs.add(value));
    }

    const responseInputByRef = exactUniqueMap(binding.actionInputBindings || [], (value) => value?.actionInputRef, "V2_PROJECTION_INPUT_BINDING_MISMATCH", "response action-input bindings");
    if (!sameExactSortedStrings([...responseInputByRef.keys()], [...expectedInputPairs])) {
      failConversion("V2_PROJECTION_INPUT_BINDING_MISMATCH", `target ${target.targetId} action-input bindings are incomplete`);
    }
    const inputElementRefs = new Map();
    for (const [inputRef, inputBinding] of responseInputByRef) {
      const [actionRef] = inputRef.split(".");
      if (inputBinding.actionRef !== actionRef || !expectedActionRefs.has(actionRef)) {
        failConversion("V2_PROJECTION_INPUT_BINDING_MISMATCH", `action input ${inputRef} has no exact physical action owner`);
      }
      exactRenderedElement(renderedElementByRef, inputBinding.elementRef, inputBinding.elementHash, `action input ${inputRef}`);
      inputElementRefs.set(inputRef, new Set([inputBinding.elementRef]));
    }
    for (const placement of placementBySlot.values()) {
      const graphControl = graphControlBySlot.get(placement.controlSlotRef);
      const expectedInputRefs = (placement.inputFields || []).map((field) => `${placement.actionRef}.${field}`);
      if (!sameExactSortedStrings(
        graphControl?.actionInputBindings?.map((value) => value.actionInputRef),
        expectedInputRefs,
      )) {
        failConversion("V2_PROJECTION_INPUT_BINDING_MISMATCH", `control slot ${placement.controlSlotRef} graph input set is incomplete`);
      }
      for (const graphInput of graphControl.actionInputBindings) {
        const responseInput = responseInputByRef.get(graphInput.actionInputRef);
        if (
          !responseInput
          || graphInput.fieldRef !== graphInput.actionInputRef.slice(placement.actionRef.length + 1)
          || graphInput.elementRef !== responseInput.elementRef
          || graphInput.elementHash !== responseInput.elementHash
        ) {
          failConversion("V2_PROJECTION_INPUT_BINDING_MISMATCH", `action input ${graphInput.actionInputRef} lost its exact graph element authority`);
        }
      }
    }

    const responseObservableByRef = exactUniqueMap(binding.observableBindings || [], (value) => value?.observableRef, "V2_PROJECTION_OBSERVABLE_BINDING_MISMATCH", "response observable bindings");
    const targetObservableByRef = exactUniqueMap(target.requiredObservableSelectors || [], (value) => value?.observableRef, "V2_PROJECTION_OBSERVABLE_BINDING_MISMATCH", "target observable selectors");
    if (!sameExactSortedStrings([...responseObservableByRef.keys()], [...targetObservableByRef.keys()])) {
      failConversion("V2_PROJECTION_OBSERVABLE_BINDING_MISMATCH", `target ${target.targetId} observable bindings are incomplete`);
    }
    const requiredObservables = [];
    for (const observable of targetObservableByRef.values()) {
      const responseObservable = responseObservableByRef.get(observable.observableRef);
      const graphObservable = graphObservableByRef.get(observable.observableRef);
      let exactSelectorElementRef;
      if (observable.selector?.kind === "control") {
        exactSelectorElementRef = responseControlBySlot.get(observable.selector.controlSlotRef)?.elementRef;
      } else if (observable.selector?.kind === "surface") {
        exactSelectorElementRef = binding.surfaceBindings.find((value) =>
          value.surfaceRef === observable.selector.surfaceRef)?.elementRef;
      }
      if (
        !responseObservable
        || !graphObservable
        || responseObservable.actionRef !== observable.actionRef
        || responseObservable.selectorKind !== observable.selector?.kind
        || responseObservable.selectorHash !== sha256Canonical(observable.selector)
        || graphObservable.actionRef !== observable.actionRef
        || graphObservable.selectorHash !== responseObservable.selectorHash
        || sha256Canonical(graphObservable.selector) !== responseObservable.selectorHash
        || !exactGraphElementSource(graphObservable.source, sourceAuthority)
        || !sameExactSortedStrings(responseObservable.elementRefs, graphObservable.elementBindings?.map((value) => value.elementRef))
        || !sameExactSortedStrings(responseObservable.elementHashes, graphObservable.elementBindings?.map((value) => value.elementHash))
        || (["control", "surface"].includes(observable.selector?.kind) && !exactSelectorElementRef)
        || (exactSelectorElementRef && !sameExactSortedStrings(responseObservable.elementRefs, [exactSelectorElementRef]))
      ) {
        failConversion("V2_PROJECTION_OBSERVABLE_BINDING_MISMATCH", `observable ${observable.observableRef} lost its exact target/binding/graph authority`);
      }
      if (responseObservable.elementRefs.length !== 1) {
        failConversion("V2_PROJECTION_OBSERVABLE_BINDING_MISMATCH", `observable ${observable.observableRef} must resolve to one exact browser element`);
      }
      const element = exactRenderedElement(
        renderedElementByRef,
        responseObservable.elementRefs[0],
        responseObservable.elementHashes[0],
        `observable ${observable.observableRef}`,
      );
      const roleReceipt = rendered.roleReceipts?.find((value) =>
        value?.observableRef === observable.observableRef);
      if (observable.selector.kind === "accessibility") {
        if (
          !roleReceipt
          || responseObservable.roleReceiptHash !== sha256Canonical(roleReceipt)
          || graphObservable.roleReceipt?.receiptHash !== responseObservable.roleReceiptHash
          || sha256Canonical(graphObservable.roleReceipt?.receipt) !== responseObservable.roleReceiptHash
          || !sameExactSortedStrings(roleReceipt.elementRefs, responseObservable.elementRefs)
          || roleReceipt.actionRef !== observable.actionRef
          || roleReceipt.selectorHash !== responseObservable.selectorHash
        ) {
          failConversion("V2_PROJECTION_OBSERVABLE_BINDING_MISMATCH", `observable ${observable.observableRef} lost its exact browser role receipt`);
        }
      } else if (responseObservable.roleReceiptHash !== null || graphObservable.roleReceipt !== null) {
        failConversion("V2_PROJECTION_OBSERVABLE_BINDING_MISMATCH", `non-accessibility observable ${observable.observableRef} cannot claim a role receipt`);
      }
      requiredObservables.push({
        observableRef: observable.observableRef,
        actionRef: observable.actionRef,
        selectorKind: observable.selector.kind,
        ...(observable.selector.kind === "control" ? { controlSlotRef: observable.selector.controlSlotRef } : {}),
        ...(observable.selector.kind !== "control" ? { surfaceRef: observable.selector.surfaceRef } : {}),
        ...(observable.selector.kind === "accessibility" ? { role: observable.selector.role, name: observable.selector.name } : {}),
        evidenceRef: graphObservable.evidenceRef,
        elementRefs: new Set(responseObservable.elementRefs),
      });
    }

    const semanticDomText = semanticDomBytes.toString("utf8");
    const exactContractRefs = new Set([
      ...binding.surfaceBindings.map((value) => value.elementRef),
      ...binding.controlSlotBindings.map((value) => value.elementRef),
      ...binding.actionInputBindings.map((value) => value.elementRef),
      ...binding.observableBindings.flatMap((value) => value.elementRefs),
    ]);
    for (const elementRef of exactContractRefs) {
      if (!/^E[0-9]{6}$/.test(elementRef)) {
        failConversion("V2_PROJECTION_RENDERED_ELEMENT_MISMATCH", "browser element ref is invalid");
      }
      const matches = semanticDomText.match(new RegExp(`\\bdata-setfarm-element-ref=(?:"${elementRef}"|'${elementRef}')`, "g")) || [];
      if (matches.length !== 1) {
        failConversion("V2_PROJECTION_RENDERED_ELEMENT_MISMATCH", `browser element ${elementRef} must occur exactly once in the semantic DOM sidecar`);
      }
    }

    if (byScreenId.has(binding.responseScreenId)) {
      failConversion("V2_PROJECTION_RESPONSE_BINDING_INVALID", "response screen identity is duplicated");
    }
    byScreenId.set(binding.responseScreenId, {
      targetRef: target.targetId,
      authorityMode: "browser_rendered_v2",
      semanticDomFile,
      semanticDomLocator: rendered.semanticDom.locator,
      contractElementRefs: exactContractRefs,
      expectedActionRefs,
      expectedInputPairs,
      actionElementRefs,
      inputElementRefs,
      controlElementRefs,
      controlByElementRef,
      requiredObservables,
    });
  }

  if (byScreenId.size !== targetById.size) {
    failConversion("V2_PROJECTION_AUTHORITY_CHAIN_MISMATCH", "native v2 projection did not close every target exactly once");
  }
  return { version: "v2", byScreenId };
}

let manifest = manifestScreens(rawManifest);
if (manifest.length === 0) {
  const fallbackManifest = fallbackManifestFromScreenMap();
  if (fallbackManifest.length > 0) {
    console.warn(`DESIGN_MANIFEST_EMPTY: falling back to SCREEN_MAP for ${fallbackManifest.length} screen(s)`);
    manifest = fallbackManifest;
  }
}

function loadV3ProjectionContract() {
  const targetsPath = path.join(stitchDir, "GENERATION_TARGETS.json");
  const bindingsPath = path.join(stitchDir, "STITCH_RESPONSE_BINDINGS.json");
  const selectionPath = path.join(stitchDir, "STITCH_TARGET_CANDIDATE_SELECTION.json");
  const renderedSemanticsPath = path.join(stitchDir, "STITCH_RENDERED_SEMANTICS.json");
  const renderedSemanticsV2Path = path.join(stitchDir, "STITCH_RENDERED_SEMANTICS_V2.json");
  const designGraphV2Path = path.join(stitchDir, "DESIGN_INTERACTION_GRAPH_V2.json");
  const hasTargets = fs.existsSync(targetsPath);
  const hasBindings = fs.existsSync(bindingsPath);
  const hasNativeV2OnlyArtifact = fs.existsSync(renderedSemanticsV2Path) || fs.existsSync(designGraphV2Path);
  if (!hasTargets && !hasBindings && !hasNativeV2OnlyArtifact) return undefined;
  if (!hasTargets || !hasBindings) {
    failConversion("V3_PROJECTION_CONTRACT_PARTIAL", "GENERATION_TARGETS.json and STITCH_RESPONSE_BINDINGS.json must exist together");
  }

  let targets;
  let bindings;
  let selection;
  let renderedSemantics;
  let renderedSemanticsV2;
  let designGraphV2;
  try {
    targets = JSON.parse(fs.readFileSync(targetsPath, "utf-8"));
    bindings = JSON.parse(fs.readFileSync(bindingsPath, "utf-8"));
    if (fs.existsSync(selectionPath)) selection = JSON.parse(fs.readFileSync(selectionPath, "utf-8"));
    if (fs.existsSync(renderedSemanticsPath)) renderedSemantics = JSON.parse(fs.readFileSync(renderedSemanticsPath, "utf-8"));
    if (fs.existsSync(renderedSemanticsV2Path)) renderedSemanticsV2 = JSON.parse(fs.readFileSync(renderedSemanticsV2Path, "utf-8"));
    if (fs.existsSync(designGraphV2Path)) designGraphV2 = JSON.parse(fs.readFileSync(designGraphV2Path, "utf-8"));
  } catch (error) {
    failConversion("V3_PROJECTION_CONTRACT_JSON_INVALID", "projection contract JSON is invalid");
  }
  if (targets?.schema === "setfarm.design-generation-targets.v2") {
    if (!selection || !renderedSemanticsV2 || !designGraphV2 || renderedSemantics) {
      failConversion(
        "V2_PROJECTION_CONTRACT_PARTIAL",
        "native v2 targets require bindings v3, selection v2, rendered semantics v2, and design graph v2 without legacy rendered semantics",
      );
    }
    return loadNativeV2ProjectionContract({
      targets,
      bindings,
      selection,
      renderedSemantics: renderedSemanticsV2,
      designGraph: designGraphV2,
    });
  }
  if (renderedSemanticsV2 || designGraphV2) {
    failConversion("V2_PROJECTION_VERSION_MIXED", "legacy projection artifacts cannot be mixed with native v2 design authority");
  }
  if (targets?.schema !== "setfarm.design-generation-targets.v1" || !Array.isArray(targets.targets)) {
    failConversion("V3_PROJECTION_TARGETS_INVALID", "exact generation targets are required for contract-only projection");
  }
  if (!["setfarm.stitch-target-response-bindings.v1", "setfarm.stitch-target-response-bindings.v2"].includes(bindings?.schema) || !Array.isArray(bindings.bindings)) {
    failConversion("V3_PROJECTION_BINDINGS_INVALID", "exact Stitch response bindings are required for contract-only projection");
  }
  if (bindings.schema === "setfarm.stitch-target-response-bindings.v2") {
    if (selection?.schema !== "setfarm.stitch-target-candidate-selection.v1" || !Array.isArray(selection.selections)) {
      failConversion("V3_PROJECTION_RESPONSE_BINDING_INVALID", "response bindings v2 require canonical target candidate selection");
    }
    if (renderedSemantics?.schema !== "setfarm.stitch-rendered-semantics.v1" || !Array.isArray(renderedSemantics.candidates)) {
      failConversion("V3_RENDERED_SEMANTICS_MISSING", "response bindings v2 require canonical browser-rendered semantics");
    }
    const targetsHash = sha256Canonical(targets);
    const selectionHash = sha256Canonical(selection);
    const renderedSemanticsHash = sha256Canonical(renderedSemantics);
    if (
      bindings.generationTargetsHash !== targetsHash
      || selection.generationTargetsHash !== targetsHash
      || renderedSemantics.generationTargetsHash !== targetsHash
      || bindings.candidateSelectionHash !== selectionHash
      || bindings.renderedSemanticsHash !== renderedSemanticsHash
      || selection.renderedSemanticsHash !== renderedSemanticsHash
      || selection.directResponseEvidenceHash !== renderedSemantics.directResponseEvidenceHash
      || selection.semanticEvidencePolicy !== "browser_rendered_v1"
    ) {
      failConversion("V3_PROJECTION_RESPONSE_BINDING_INVALID", "projection targets, rendered semantics, selection, and bindings do not form one canonical hash chain");
    }
  } else if (selection || renderedSemantics) {
    failConversion("V3_PROJECTION_RESPONSE_BINDING_INVALID", "historical v1 bindings cannot claim candidate-selection authority");
  }

  const targetById = new Map();
  for (const target of targets.targets) {
    if (!target?.targetId || targetById.has(target.targetId)) {
      failConversion("V3_PROJECTION_TARGET_ID_INVALID", "projection target identity is missing or duplicated");
    }
    targetById.set(target.targetId, target);
  }
  const byScreenId = new Map();
  const selectionByTarget = new Map(Array.isArray(selection?.selections)
    ? selection.selections.map((item) => [item.targetRef, item])
    : []);
  const selectionCandidateById = new Map(Array.isArray(selection?.candidates)
    ? selection.candidates.map((item) => [item.screenId, item])
    : []);
  const renderedCandidateById = new Map(Array.isArray(renderedSemantics?.candidates)
    ? renderedSemantics.candidates.map((item) => [item.screenId, item])
    : []);
  for (const binding of bindings.bindings) {
    const target = targetById.get(binding?.targetRef);
    if (!target || !binding?.responseScreenId || byScreenId.has(binding.responseScreenId)) {
      failConversion("V3_PROJECTION_RESPONSE_BINDING_INVALID", "projection response binding is missing, duplicated, or unowned");
    }
    if (bindings.schema === "setfarm.stitch-target-response-bindings.v2") {
      const selected = selectionByTarget.get(binding.targetRef);
      const selectedEvaluation = selected?.evaluations?.find((evaluation) => evaluation?.screenId === binding.responseScreenId);
      const selectedCandidate = selectionCandidateById.get(binding.responseScreenId);
      const renderedCandidate = renderedCandidateById.get(binding.responseScreenId);
      const htmlPath = path.join(stitchDir, `${binding.responseScreenId}.html`);
      const screenshotPath = path.join(stitchDir, `${binding.responseScreenId}.png`);
      if (
        selected?.status !== "selected"
        || selected.selectedScreenId !== binding.responseScreenId
        || selected.stageId !== binding.stageId
        || selectedEvaluation?.qualificationTier !== "exact_target_semantics"
        || !Array.isArray(selectedEvaluation.semanticChecks)
        || selectedEvaluation.semanticChecks.some((check) => check?.disposition !== "exact")
        || selectedCandidate?.semanticEvidenceStatus !== "browser_rendered"
        || renderedCandidate?.status !== "rendered"
        || renderedCandidate.stageId !== binding.stageId
        || !fs.existsSync(htmlPath)
        || !fs.existsSync(screenshotPath)
        || sha256Bytes(fs.readFileSync(htmlPath)) !== binding.htmlArtifactHash
        || sha256Bytes(fs.readFileSync(screenshotPath)) !== binding.screenshotArtifactHash
        || selectedCandidate.htmlArtifactHash !== binding.htmlArtifactHash
        || selectedCandidate.screenshotArtifactHash !== binding.screenshotArtifactHash
        || renderedCandidate.htmlArtifactHash !== binding.htmlArtifactHash
        || renderedCandidate.screenshotArtifactHash !== binding.screenshotArtifactHash
        || selectedCandidate.semanticDomHash !== binding.semanticDomHash
        || selectedCandidate.semanticObservationHash !== binding.semanticObservationHash
        || renderedCandidate.semanticDom?.hash !== binding.semanticDomHash
        || renderedCandidate.observationHash !== binding.semanticObservationHash
        || sha256Canonical(renderedCandidate.elements) !== renderedCandidate.observationHash
      ) {
        failConversion("V3_PROJECTION_RESPONSE_BINDING_INVALID", "selected response artifact bytes do not match response bindings v2");
      }

      const exactChecks = selectedEvaluation.semanticChecks.filter((check) =>
        check.kind !== "screen_title" && check.disposition === "exact");
      const exactContractRefs = exactChecks.flatMap((check) => check.elementRefs || []);
      if (!sameSortedStrings(exactContractRefs, binding.contractElementRefs)) {
        failConversion("V3_RENDERED_CONTRACT_ELEMENT_REFS_INVALID", "response binding element refs differ from exact browser semantic checks");
      }
      const renderedElements = Array.isArray(renderedCandidate.elements) ? renderedCandidate.elements : [];
      const elementByRef = new Map(renderedElements.map((element) => [element.elementRef, element]));
      if (
        elementByRef.size !== renderedElements.length
        || binding.contractElementRefs.some((ref) => !elementByRef.has(ref))
      ) {
        failConversion("V3_RENDERED_CONTRACT_ELEMENT_REFS_INVALID", "response binding contains missing or duplicated rendered element refs");
      }
      const semanticDomFile = exactRepoLocator(renderedCandidate.semanticDom?.locator, "stitch/rendered-dom/");
      if (!fs.existsSync(semanticDomFile)) {
        failConversion("V3_RENDERED_SEMANTIC_DOM_MISSING", "selected rendered semantic DOM sidecar is missing");
      }
      const semanticDomBytes = fs.readFileSync(semanticDomFile);
      if (
        semanticDomBytes.byteLength !== renderedCandidate.semanticDom.byteLength
        || sha256Bytes(semanticDomBytes) !== binding.semanticDomHash
      ) {
        failConversion("V3_RENDERED_SEMANTIC_DOM_HASH_MISMATCH", "selected rendered semantic DOM sidecar bytes do not match browser authority");
      }
      const semanticDomText = semanticDomBytes.toString("utf8");
      for (const elementRef of binding.contractElementRefs) {
        const matches = semanticDomText.match(new RegExp(`\\bdata-setfarm-element-ref=(?:"${elementRef}"|'${elementRef}')`, "g")) || [];
        if (matches.length !== 1) {
          failConversion("V3_RENDERED_CONTRACT_ELEMENT_REFS_INVALID", "each bound rendered element ref must occur exactly once in the semantic DOM sidecar");
        }
      }

      const exactRefs = (kind, semanticRef) => {
        const checks = exactChecks.filter((check) => check.kind === kind && check.semanticRef === semanticRef);
        if (checks.length !== 1 || checks[0].expectedCount !== 1 || checks[0].observedCount !== 1 || checks[0].elementRefs?.length !== 1) {
          failConversion("V3_RENDERED_SEMANTIC_CHECK_INVALID", `required ${kind} ${semanticRef} lacks one exact browser element ref`);
        }
        return new Set(checks[0].elementRefs);
      };
      const actionElementRefs = new Map((target.requiredActionRefs || []).map((actionRef) => [
        actionRef,
        exactRefs("action", actionRef),
      ]));
      const expectedInputPairs = (Array.isArray(target.requiredActionInputs) ? target.requiredActionInputs : [])
        .flatMap((entry) => (Array.isArray(entry?.inputFields) ? entry.inputFields : [])
          .map((field) => `${entry.actionRef}.${field}`));
      const inputElementRefs = new Map(expectedInputPairs.map((inputRef) => [
        inputRef,
        exactRefs("action_input", inputRef),
      ]));
      const requiredAccessibilityObservables = (Array.isArray(target.requiredObservableSelectors)
        ? target.requiredObservableSelectors
        : [])
        .filter((entry) => entry?.selector?.kind === "accessibility")
        .map((entry) => ({
          observableRef: String(entry.observableRef || ""),
          role: String(entry.selector.role || ""),
          name: String(entry.selector.name || ""),
          elementRefs: exactRefs("accessibility", String(entry.observableRef || "")),
        }));
      for (const [semanticRef, refs] of [
        ...actionElementRefs,
        ...inputElementRefs,
        ...requiredAccessibilityObservables.map((item) => [item.observableRef, item.elementRefs]),
      ]) {
        const element = elementByRef.get([...refs][0]);
        if (!element || element.renderState !== "rendered" || element.nearestSurfaceRef !== target.surfaceRef) {
          failConversion("V3_RENDERED_SEMANTIC_CHECK_INVALID", `required semantic ref ${semanticRef} is not rendered on its exact surface`);
        }
      }
      byScreenId.set(binding.responseScreenId, {
        targetRef: target.targetId,
        authorityMode: "browser_rendered_v1",
        semanticDomFile,
        semanticDomLocator: renderedCandidate.semanticDom.locator,
        contractElementRefs: new Set(binding.contractElementRefs),
        expectedActionRefs: new Set(Array.isArray(target.requiredActionRefs) ? target.requiredActionRefs : []),
        expectedInputPairs: new Set(expectedInputPairs),
        actionElementRefs,
        inputElementRefs,
        requiredAccessibilityObservables,
      });
      continue;
    }
    byScreenId.set(binding.responseScreenId, {
      targetRef: target.targetId,
      authorityMode: "historical_static_v1",
      expectedActionRefs: new Set(Array.isArray(target.requiredActionRefs) ? target.requiredActionRefs : []),
      expectedInputPairs: new Set((Array.isArray(target.requiredActionInputs) ? target.requiredActionInputs : [])
        .flatMap((entry) => (Array.isArray(entry?.inputFields) ? entry.inputFields : [])
          .map((field) => `${entry.actionRef}.${field}`))),
      requiredAccessibilityObservables: (Array.isArray(target.requiredObservableSelectors)
        ? target.requiredObservableSelectors
        : [])
        .filter((entry) => entry?.selector?.kind === "accessibility")
        .map((entry) => ({
          observableRef: String(entry.observableRef || ""),
          role: String(entry.selector.role || ""),
          name: String(entry.selector.name || ""),
        })),
    });
  }
  return { byScreenId };
}

const v3ProjectionContract = loadV3ProjectionContract();

const JSX_ATTRIBUTE_MAP = {
  "accept-charset": "acceptCharset",
  "allowfullscreen": "allowFullScreen",
  "autocomplete": "autoComplete",
  "autofocus": "autoFocus",
  "class": "className",
  "colspan": "colSpan",
  "contenteditable": "contentEditable",
  "crossorigin": "crossOrigin",
  "datetime": "dateTime",
  "enctype": "encType",
  "for": "htmlFor",
  "formaction": "formAction",
  "formenctype": "formEncType",
  "formmethod": "formMethod",
  "formnovalidate": "formNoValidate",
  "formtarget": "formTarget",
  "http-equiv": "httpEquiv",
  "maxlength": "maxLength",
  "minlength": "minLength",
  "novalidate": "noValidate",
  "playsinline": "playsInline",
  "readonly": "readOnly",
  "rowspan": "rowSpan",
  "spellcheck": "spellCheck",
  "srcset": "srcSet",
  "tabindex": "tabIndex",
  "usemap": "useMap",
  "viewbox": "viewBox",
  "preserveaspectratio": "preserveAspectRatio",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "stroke-opacity": "strokeOpacity",
  "fill-rule": "fillRule",
  "fill-opacity": "fillOpacity",
  "clip-rule": "clipRule",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "basefrequency": "baseFrequency",
  "color-interpolation-filters": "colorInterpolationFilters",
  "diffuseconstant": "diffuseConstant",
  "edgemode": "edgeMode",
  "kernelmatrix": "kernelMatrix",
  "kernelunitlength": "kernelUnitLength",
  "limitingconeangle": "limitingConeAngle",
  "numoctaves": "numOctaves",
  "specularconstant": "specularConstant",
  "specularexponent": "specularExponent",
  "stddeviation": "stdDeviation",
  "surfacescale": "surfaceScale",
  "patternunits": "patternUnits",
  "patterncontentunits": "patternContentUnits",
  "gradientunits": "gradientUnits",
  "gradienttransform": "gradientTransform",
  "maskunits": "maskUnits",
  "maskcontentunits": "maskContentUnits",
  "clippathunits": "clipPathUnits",
  "xlink:href": "xlinkHref",
  "xmlns:xlink": "xmlnsXlink",
};

const JSX_TAG_MAP = {
  "feblend": "feBlend",
  "fecolormatrix": "feColorMatrix",
  "fecomponenttransfer": "feComponentTransfer",
  "fecomposite": "feComposite",
  "feconvolvematrix": "feConvolveMatrix",
  "fediffuselighting": "feDiffuseLighting",
  "fedisplacementmap": "feDisplacementMap",
  "fedistantlight": "feDistantLight",
  "fedropshadow": "feDropShadow",
  "feflood": "feFlood",
  "fefunca": "feFuncA",
  "fefuncb": "feFuncB",
  "fefuncg": "feFuncG",
  "fefuncr": "feFuncR",
  "fegaussianblur": "feGaussianBlur",
  "feimage": "feImage",
  "femerge": "feMerge",
  "femergenode": "feMergeNode",
  "femorphology": "feMorphology",
  "feoffset": "feOffset",
  "fepointlight": "fePointLight",
  "fespecularlighting": "feSpecularLighting",
  "fespotlight": "feSpotLight",
  "fetile": "feTile",
  "feturbulence": "feTurbulence",
  "lineargradient": "linearGradient",
  "radialgradient": "radialGradient",
  "clippath": "clipPath",
  "foreignobject": "foreignObject",
  "textpath": "textPath",
  "pattern": "pattern",
};

const NUMERIC_JSX_ATTRIBUTES = new Set([
  "aria-colcount",
  "aria-colindex",
  "aria-colspan",
  "aria-level",
  "aria-posinset",
  "aria-rowcount",
  "aria-rowindex",
  "aria-rowspan",
  "aria-setsize",
  "aria-valuemax",
  "aria-valuemin",
  "aria-valuenow",
  "colSpan",
  "cols",
  "maxLength",
  "minLength",
  "rowSpan",
  "rows",
  "size",
  "span",
  "start",
  "tabIndex",
]);

const BOOLEAN_JSX_ATTRIBUTES = new Set([
  "allowFullScreen",
  "async",
  "autoFocus",
  "autoPlay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formNoValidate",
  "hidden",
  "loop",
  "multiple",
  "muted",
  "noValidate",
  "open",
  "playsInline",
  "readOnly",
  "required",
  "reversed",
  "selected",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeJsxAttributeNames(input) {
  let out = input;
  for (const [htmlAttr, jsxAttr] of Object.entries(JSX_ATTRIBUTE_MAP)) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(htmlAttr)}=`, "gi"), `${jsxAttr}=`);
  }
  return out;
}

function normalizeJsxTagNames(input) {
  let out = input;
  for (const [htmlTag, jsxTag] of Object.entries(JSX_TAG_MAP)) {
    out = out.replace(new RegExp(`<\\s*${escapeRegExp(htmlTag)}\\b`, "gi"), `<${jsxTag}`);
    out = out.replace(new RegExp(`<\\/\\s*${escapeRegExp(htmlTag)}\\s*>`, "gi"), `</${jsxTag}>`);
  }
  return out;
}

function normalizeJsxAttributeValues(input) {
  let out = input;
  for (const attr of NUMERIC_JSX_ATTRIBUTES) {
    out = out.replace(
      new RegExp(`\\b${escapeRegExp(attr)}=["'](-?\\d+(?:\\.\\d+)?)["']`, "g"),
      `${attr}={$1}`,
    );
  }
  for (const attr of BOOLEAN_JSX_ATTRIBUTES) {
    out = out.replace(
      new RegExp(`\\b${escapeRegExp(attr)}=["']\\s*["']`, "gi"),
      `${attr}={true}`,
    );
    out = out.replace(
      new RegExp(`\\b${escapeRegExp(attr)}=["'](?:true|${escapeRegExp(attr)})["']`, "gi"),
      `${attr}={true}`,
    );
    out = out.replace(
      new RegExp(`\\b${escapeRegExp(attr)}=["']false["']`, "gi"),
      `${attr}={false}`,
    );
  }
  return out;
}

function normalizeHtmlComments(input) {
  return input.replace(/<!--([\s\S]*?)-->/g, (_, body) => {
    const cleaned = String(body || "")
      .replace(/\*\//g, "* /")
      .trim();
    return cleaned ? `{/* ${cleaned} */}` : "{/* */}";
  });
}


function escapeTemplateLiteralContent(input) {
  return String(input || "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

function normalizeStyleTagChildren(input) {
  return input.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs, css) => {
    const cleanAttrs = String(attrs || "").trimEnd();
    return `<style${cleanAttrs}>{\`${escapeTemplateLiteralContent(css)}\`}</style>`;
  });
}

function escapeDiagnosticPseudoTags(input) {
  return String(input || "").replace(/<\/?\s*(anonymous|unknown|native)\s*>/gi, (match, tagName) => {
    const closing = /^<\s*\//.test(match) ? "/" : "";
    return `&lt;${closing}${String(tagName || "").toLowerCase()}&gt;`;
  });
}

function copyJsxExpression(input, start) {
  if (input.startsWith("{/*", start)) {
    const end = input.indexOf("*/}", start + 3);
    return end >= 0 ? { text: input.slice(start, end + 3), next: end + 3 } : null;
  }
  if (input.startsWith("{`", start)) {
    let i = start + 2;
    while (i < input.length) {
      if (input[i] === "\\") {
        i += 2;
        continue;
      }
      if (input[i] === "`" && input[i + 1] === "}") {
        return { text: input.slice(start, i + 2), next: i + 2 };
      }
      i++;
    }
  }
  return null;
}

function escapeJsxTextBraces(input) {
  let out = "";
  let inTag = false;
  let quote = "";

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inTag) {
      out += ch;
      if (quote) {
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === "\"" || ch === "'") {
        quote = ch;
      } else if (ch === ">") {
        inTag = false;
      }
      continue;
    }

    if (ch === "<") {
      inTag = true;
      out += ch;
      continue;
    }

    if (ch === "{") {
      const expression = copyJsxExpression(input, i);
      if (expression) {
        out += expression.text;
        i = expression.next - 1;
      } else {
        out += "&#123;";
      }
      continue;
    }

    if (ch === "}") {
      out += "&#125;";
      continue;
    }

    out += ch;
  }

  return out;
}

function toReactStylePropertyKey(rawKey) {
  const cssKey = String(rawKey || "").trim();
  if (!cssKey) return "";
  if (cssKey.startsWith("--")) return JSON.stringify(cssKey);
  const jsKey = cssKey
    .replace(/^-ms-/, "ms-")
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return /^[A-Za-z_$][\w$]*$/.test(jsKey) ? jsKey : JSON.stringify(cssKey);
}

const RESPONSIVE_STYLE_PREFIXES = new Set(["sm", "md", "lg", "xl", "2xl"]);

function isResponsiveInlineStyleDeclaration(cssKey, rawValue) {
  return RESPONSIVE_STYLE_PREFIXES.has(cssKey)
    && /^[a-z-]+\s*:/i.test(String(rawValue || "").trim());
}

function inlineStyleToJsx(styleText) {
  let needsTypeEscape = false;
  const pairs = String(styleText || "")
    .split(";")
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => {
      const [rawKey, ...rawValue] = x.split(":");
      const cssKey = String(rawKey || "").trim();
      const value = rawValue.join(":").trim();
      if (isResponsiveInlineStyleDeclaration(cssKey, value)) return "";
      const key = toReactStylePropertyKey(cssKey);
      if (!key) return "";
      if (cssKey.startsWith("--")) needsTypeEscape = true;
      return `${key}: ${JSON.stringify(value)}`;
    })
    .filter(Boolean);
  const suffix = needsTypeEscape ? " as any" : "";
  return `style={{${pairs.join(", ")}}${suffix}}`;
}

function stripJsxAttribute(attrs, attrName) {
  const pattern = new RegExp(
    `\\s+${escapeRegExp(attrName)}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{[^}]*\\}|[^\\s"'=<>]+))?`,
    "gi",
  );
  return String(attrs || "").replace(pattern, "");
}

function dedupeJsxAttributes(input) {
  return String(input || "").replace(/<([A-Za-z][\w.:]*)\b([^<>]*?)(\/?)>/g, (match, tag, attrs, selfClose) => {
    if (!attrs || match.startsWith("</")) return match;
    const attrPattern = /\s+([A-Za-z_:$][\w:.-]*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^\s"'=<>]+))?/g;
    const seen = new Set();
    let out = "";
    let last = 0;
    for (const attr of attrs.matchAll(attrPattern)) {
      const index = attr.index ?? 0;
      const name = String(attr[1] || "").toLowerCase();
      out += attrs.slice(last, index);
      if (!seen.has(name)) {
        seen.add(name);
        out += attr[0];
      }
      last = index + attr[0].length;
    }
    out += attrs.slice(last);
    return `<${tag}${out}${selfClose}>`;
  });
}

function stripInlineEventHandlerAttributes(input) {
  return String(input || "").replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
}

const VOID_HTML_TAGS = new Set(["img", "br", "hr", "input", "meta", "link"]);

function findTagEndRespectingQuotes(input, start) {
  let quote = "";
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ">") return i;
  }
  return -1;
}

function mapOpeningTagsRespectingQuotes(input, transform) {
  const source = String(input || "");
  let out = "";
  let cursor = 0;
  const tagPattern = /<([A-Za-z][\w:-]*)\b/g;
  let match;
  while ((match = tagPattern.exec(source)) !== null) {
    const tagStart = match.index;
    const tagEnd = findTagEndRespectingQuotes(source, tagPattern.lastIndex);
    if (tagEnd < 0) break;
    const tagName = String(match[1] || "");
    const attrs = source.slice(tagPattern.lastIndex, tagEnd);
    const original = source.slice(tagStart, tagEnd + 1);
    out += source.slice(cursor, tagStart);
    out += transform({ tagName, attrs, original });
    cursor = tagEnd + 1;
    tagPattern.lastIndex = tagEnd + 1;
  }
  return out + source.slice(cursor);
}

function mapPairedTagsRespectingQuotes(input, targetTagName, transform) {
  const source = String(input || "");
  const tagName = String(targetTagName || "");
  let out = "";
  let cursor = 0;
  const openingPattern = new RegExp(`<${escapeRegExp(tagName)}(?=[\\s/>])`, "gi");
  const closingPattern = new RegExp(`</${escapeRegExp(tagName)}\\s*>`, "gi");
  let opening;
  while ((opening = openingPattern.exec(source)) !== null) {
    const tagStart = opening.index;
    const tagEnd = findTagEndRespectingQuotes(source, openingPattern.lastIndex);
    if (tagEnd < 0) break;
    closingPattern.lastIndex = tagEnd + 1;
    const closing = closingPattern.exec(source);
    if (!closing) break;
    const closingEnd = closing.index + closing[0].length;
    const attrs = source.slice(openingPattern.lastIndex, tagEnd);
    const inner = source.slice(tagEnd + 1, closing.index);
    const original = source.slice(tagStart, closingEnd);
    out += source.slice(cursor, tagStart);
    out += transform({ tagName, attrs, inner, original });
    cursor = closingEnd;
    openingPattern.lastIndex = closingEnd;
  }
  return out + source.slice(cursor);
}

function normalizeVoidElementStartTags(input) {
  const source = String(input || "");
  let out = "";
  let cursor = 0;
  const tagPattern = /<\/?\s*([A-Za-z][\w:-]*)\b/g;
  let match;
  while ((match = tagPattern.exec(source)) !== null) {
    const tagStart = match.index;
    const tagName = String(match[1] || "").toLowerCase();
    if (!VOID_HTML_TAGS.has(tagName) || source[tagStart + 1] === "/") continue;
    const tagEnd = findTagEndRespectingQuotes(source, tagPattern.lastIndex);
    if (tagEnd < 0) break;
    const attrs = source.slice(tagPattern.lastIndex, tagEnd);
    const cleanAttrs = attrs.replace(/\/\s*$/, "").trimEnd();
    out += source.slice(cursor, tagStart);
    out += `<${match[1]}${cleanAttrs} />`;
    cursor = tagEnd + 1;
    tagPattern.lastIndex = tagEnd + 1;
  }
  return out + source.slice(cursor);
}

function htmlToJsx(html) {
  let out = normalizeVoidElementStartTags(normalizeJsxAttributeValues(normalizeJsxAttributeNames(normalizeJsxTagNames(stripInlineEventHandlerAttributes(html)))))
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*\/?\s*>/gi, "")
    .replace(/<meta[^>]*\/?\s*>/gi, "")
      .replace(/style="([^"]+)"/g, (_, s) => inlineStyleToJsx(s));
  out = normalizeStyleTagChildren(out);
  out = escapeDiagnosticPseudoTags(out);
  return dedupeJsxAttributes(escapeJsxTextBraces(normalizeHtmlComments(out)));
}

function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1].trim() : html;
}

function toComponentName(title) {
  return title
    .replace(/[\u0131\u0130]/g,"i").replace(/[\u015f\u015e]/g,"s").replace(/[\u00e7\u00c7]/g,"c")
    .replace(/[\u011f\u011e]/g,"g").replace(/[\u00fc\u00dc]/g,"u").replace(/[\u00f6\u00d6]/g,"o")
    .replace(/[^a-zA-Z0-9\s]/g,"")
    .split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function textFromHtml(input) {
  return String(input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "and")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function materialIconNamesFromHtml(input) {
  const names = [];
  String(input || "").replace(
    /<span\b([^>]*)\b(class|className)=(["'])([^"']*\b(?:material-symbols(?:-outlined)?|material-icons)\b[^"']*)\3([^>]*)>([\s\S]*?)<\/span>/gi,
    (_match, beforeClass, _classAttr, _quote, _classValue, afterClass, inner) => {
      const attrs = `${beforeClass || ""}${afterClass || ""}`;
      const name = attrValue(attrs, "data-icon") || materialIconKey(inner);
      if (name) names.push(name);
      return "";
    },
  );
  return names;
}

function stripMaterialIconSpans(input) {
  return String(input || "").replace(
    /<span\b([^>]*)\b(class|className)=(["'])([^"']*\b(?:material-symbols(?:-outlined)?|material-icons)\b[^"']*)\3([^>]*)>[\s\S]*?<\/span>/gi,
    " ",
  );
}

function humanizeActionLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function labelFromInteractive(attrs, inner, fallback) {
  const explicit = attrValue(attrs, "aria-label") || attrValue(attrs, "title");
  if (explicit) return explicit;

  const visible = textFromHtml(stripMaterialIconSpans(inner));
  if (visible) return visible;

  const iconName = materialIconNamesFromHtml(inner)[0];
  if (iconName) return humanizeActionLabel(iconName);

  return fallback;
}

const MATERIAL_TO_LUCIDE = {
  account_circle: "CircleUserRound",
  account_tree: "GitBranch",
  add: "Plus",
  add_box: "PlusSquare",
  add_circle: "CirclePlus",
  ads_click: "MousePointerClick",
  airline_seat_recline_normal: "Armchair",
  analytics: "BarChart3",
  api: "Braces",
  arrow_back: "ArrowLeft",
  arrow_drop_down: "ChevronDown",
  arrow_drop_up: "ChevronUp",
  arrow_downward: "ArrowDown",
  arrow_forward: "ArrowRight",
  arrow_left: "ArrowLeft",
  arrow_right: "ArrowRight",
  arrow_right_alt: "ArrowRight",
  arrow_upward: "ArrowUp",
  article: "FileText",
  assignment: "ClipboardList",
  assignment_ind: "ClipboardCheck",
  assignment_return: "PackageCheck",
  auto_awesome: "Sparkles",
  badge: "Badge",
  bed: "Bed",
  blur_off: "EyeOff",
  blur_on: "Sparkles",
  bolt: "Bolt",
  bug_report: "Bug",
  build: "Wrench",
  calendar_month: "CalendarDays",
  calendar_today: "CalendarDays",
  cancel: "Ban",
  check: "Check",
  check_circle: "CheckCircle2",
  change_history: "Triangle",
  checklist: "ListChecks",
  chevron_left: "ChevronLeft",
  chevron_right: "ChevronRight",
  cleaning_services: "Sparkles",
  clear_all: "ListX",
  circle: "Circle",
  clinical_notes: "ClipboardPlus",
  close: "X",
  cloud: "Cloud",
  cloud_off: "CloudOff",
  code: "Code",
  contact_phone: "PhoneCall",
  contact_support: "CircleHelp",
  dashboard: "LayoutDashboard",
  data_object: "Braces",
  data_usage: "Database",
  database: "Database",
  dataset: "Database",
  dataset_linked: "DatabaseZap",
  date_range: "CalendarDays",
  delete: "Trash2",
  delete_sweep: "Trash2",
  density_medium: "Rows3",
  density_small: "Rows2",
  deployed_code: "Package",
  description: "FileText",
  desktop_windows: "Monitor",
  device_reset: "RotateCcw",
  directions_car: "Car",
  display_settings: "Monitor",
  dns: "Server",
  done_all: "CheckCheck",
  donut_small: "PieChart",
  download: "Download",
  drag_indicator: "GripVertical",
  dynamic_feed: "Rows3",
  edit: "Pencil",
  edit_document: "FilePenLine",
  edit_note: "Pencil",
  edit_square: "Pencil",
  ecg_heart: "HeartPulse",
  electric_bolt: "Zap",
  emoji_events: "Trophy",
  engineering: "HardHat",
  error: "CircleAlert",
  error_outline: "CircleAlert",
  exercise: "Dumbbell",
  exit_to_app: "LogOut",
  fact_check: "BadgeCheck",
  fast_forward: "FastForward",
  face: "Smile",
  filter_alt: "Filter",
  filter_list: "ListFilter",
  filter_list_off: "FilterX",
  flag: "Flag",
  flash_on: "Zap",
  flight: "Plane",
  flight_land: "PlaneLanding",
  flight_takeoff: "PlaneTakeoff",
  folder_off: "FolderX",
  folder_open: "FolderOpen",
  favorite: "Heart",
  gavel: "Gavel",
  equalizer: "AudioWaveform",
  graphic_eq: "AudioWaveform",
  grid_view: "Grid3X3",
  gpp_bad: "ShieldAlert",
  gpp_maybe: "ShieldAlert",
  group: "Users",
  group_remove: "UserMinus",
  groups: "UsersRound",
  help: "CircleHelp",
  help_center: "CircleHelp",
  help_outline: "CircleHelp",
  history: "History",
  horizontal_rule: "Minus",
  home: "Home",
  how_to_reg: "UserCheck",
  hub: "Network",
  inbox: "Inbox",
  info: "Info",
  insights: "Lightbulb",
  interests: "Shapes",
  inventory: "Archive",
  inventory_2: "PackageSearch",
  key: "Key",
  keyboard: "Keyboard",
  keyboard_alt: "Keyboard",
  keyboard_arrow_down: "ChevronDown",
  keyboard_arrow_left: "ChevronLeft",
  keyboard_arrow_right: "ChevronRight",
  keyboard_voice: "Mic",
  keyboard_return: "CornerDownLeft",
  label: "Tag",
  language: "Languages",
  lan: "Network",
  leaderboard: "Trophy",
  layers: "Layers",
  lens: "Circle",
  lightbulb: "Lightbulb",
  list: "List",
  list_alt: "ListTodo",
  format_list_numbered: "ListOrdered",
  local_fire_department: "Flame",
  local_gas_station: "Fuel",
  local_shipping: "Truck",
  local_hospital: "Hospital",
  location_on: "MapPin",
  login: "LogIn",
  logout: "LogOut",
  mail: "Mail",
  map: "Map",
  medical_services: "BriefcaseMedical",
  meeting_room: "DoorOpen",
  memory: "Cpu",
  menu: "Menu",
  menu_book: "BookOpen",
  monitor: "Monitor",
  mouse: "MousePointerClick",
  near_me: "Navigation",
  notifications: "Bell",
  notifications_active: "BellRing",
  notification_important: "BellRing",
  notes: "StickyNote",
  more_horiz: "Ellipsis",
  more_vert: "EllipsisVertical",
  monitoring: "Activity",
  monitor_heart: "HeartPulse",
  music_note: "Music",
  open_in_full: "Expand",
  open_in_new: "ExternalLink",
  pause: "Pause",
  pause_circle: "CirclePause",
  person: "User",
  person_add: "UserPlus",
  person_search: "UserSearch",
  pending_actions: "ClipboardList",
  pie_chart: "PieChart",
  policy: "ShieldAlert",
  play_arrow: "Play",
  play_circle: "CirclePlay",
  power: "Power",
  power_settings_new: "Power",
  precision_manufacturing: "Factory",
  priority_high: "BadgeAlert",
  progress_activity: "LoaderCircle",
  queue: "ListOrdered",
  query_stats: "BarChart3",
  rebase_edit: "GitCompareArrows",
  refresh: "RefreshCw",
  reorder: "GripHorizontal",
  restart_alt: "RotateCcw",
  replay: "RefreshCcw",
  restore: "RotateCcw",
  rotate_right: "RotateCw",
  route: "Route",
  router: "Router",
  rocket_launch: "Rocket",
  rule: "Ruler",
  save: "Save",
  schedule: "Clock",
  science: "FlaskConical",
  scoreboard: "Trophy",
  search: "Search",
  search_off: "SearchX",
  sensors: "RadioTower",
  settings: "Settings",
  settings_applications: "Settings2",
  settings_input_component: "SlidersHorizontal",
  settings_suggest: "Settings2",
  shield: "Shield",
  show_chart: "TrendingUp",
  sort: "ArrowUpDown",
  south_east: "MoveDownRight",
  speed: "Gauge",
  sports_esports: "Gamepad2",
  smartphone: "Smartphone",
  space_bar: "Space",
  stacked_line_chart: "TrendingUp",
  style: "Palette",
  swords: "Swords",
  swap_horiz: "ArrowLeftRight",
  sync: "RefreshCw",
  sync_alt: "RefreshCcw",
  sync_problem: "RefreshCwOff",
  sync_saved_locally: "Save",
  support_agent: "Headphones",
  table_rows: "Rows3",
  task_alt: "BadgeCheck",
  terrain: "Mountain",
  terminal: "Terminal",
  timer: "Timer",
  title: "Type",
  tips_and_updates: "Lightbulb",
  toggle_on: "ToggleRight",
  token: "Coins",
  touch_app: "MousePointerClick",
  train: "Train",
  trending_up: "TrendingUp",
  trip_origin: "CircleDot",
  trophy: "Trophy",
  tune: "SlidersHorizontal",
  unfold_more: "ChevronsUpDown",
  videogame_asset: "Gamepad2",
  vibration: "Vibrate",
  vital_signs: "HeartPulse",
  volume_down: "Volume1",
  volume_mute: "VolumeX",
  volume_up: "Volume2",
  view_agenda: "Rows3",
  view_column: "Columns3",
  view_week: "Columns3",
  view_kanban: "Kanban",
  view_list: "List",
  view_module: "LayoutGrid",
  visibility: "Eye",
  view_timeline: "Activity",
  warning: "TriangleAlert",
  widgets: "Boxes",
  warehouse: "Warehouse",
  wifi: "Wifi",
  wifi_off: "WifiOff",
  wifi_tether: "RadioTower",
  wifi_tethering: "RadioTower",
  expand_more: "ChevronDown",
  tv_options_parental: "MonitorCog",
  update: "RefreshCw",
  call: "Phone",
  block: "Ban",
  report: "FileWarning",
  star: "Star",
  stars: "Sparkles",
  straighten: "Ruler",
  storage: "Database",
  work: "Briefcase",
};

// Bounded source-local icon geometry derived from lucide-static 0.468.0 (ISC).
// Only names reachable from MATERIAL_TO_LUCIDE are embedded; generated screens
// therefore need no runtime icon import or custom JSX component authority.
const INTRINSIC_ICON_BODY_BY_LUCIDE = Object.freeze({
  "Activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\" />",
  "Archive": "<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\" /><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\" /><path d=\"M10 12h4\" />",
  "Armchair": "<path d=\"M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3\" /><path d=\"M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z\" /><path d=\"M5 18v2\" /><path d=\"M19 18v2\" />",
  "ArrowDown": "<path d=\"M12 5v14\" /><path d=\"m19 12-7 7-7-7\" />",
  "ArrowLeft": "<path d=\"m12 19-7-7 7-7\" /><path d=\"M19 12H5\" />",
  "ArrowLeftRight": "<path d=\"M8 3 4 7l4 4\" /><path d=\"M4 7h16\" /><path d=\"m16 21 4-4-4-4\" /><path d=\"M20 17H4\" />",
  "ArrowRight": "<path d=\"M5 12h14\" /><path d=\"m12 5 7 7-7 7\" />",
  "ArrowUp": "<path d=\"m5 12 7-7 7 7\" /><path d=\"M12 19V5\" />",
  "ArrowUpDown": "<path d=\"m21 16-4 4-4-4\" /><path d=\"M17 20V4\" /><path d=\"m3 8 4-4 4 4\" /><path d=\"M7 4v16\" />",
  "AudioWaveform": "<path d=\"M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2\" />",
  "Badge": "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\" />",
  "BadgeAlert": "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\" /><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\" /><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\" />",
  "BadgeCheck": "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\" /><path d=\"m9 12 2 2 4-4\" />",
  "Ban": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m4.9 4.9 14.2 14.2\" />",
  "BarChart3": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /><path d=\"M18 17V9\" /><path d=\"M13 17V5\" /><path d=\"M8 17v-3\" />",
  "Bed": "<path d=\"M2 4v16\" /><path d=\"M2 8h18a2 2 0 0 1 2 2v10\" /><path d=\"M2 17h20\" /><path d=\"M6 8v9\" />",
  "Bell": "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\" /><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\" />",
  "BellRing": "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\" /><path d=\"M22 8c0-2.3-.8-4.3-2-6\" /><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\" /><path d=\"M4 2C2.8 3.7 2 5.7 2 8\" />",
  "Bolt": "<path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" /><circle cx=\"12\" cy=\"12\" r=\"4\" />",
  "BookOpen": "<path d=\"M12 7v14\" /><path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\" />",
  "Boxes": "<path d=\"M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z\" /><path d=\"m7 16.5-4.74-2.85\" /><path d=\"m7 16.5 5-3\" /><path d=\"M7 16.5v5.17\" /><path d=\"M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z\" /><path d=\"m17 16.5-5-3\" /><path d=\"m17 16.5 4.74-2.85\" /><path d=\"M17 16.5v5.17\" /><path d=\"M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z\" /><path d=\"M12 8 7.26 5.15\" /><path d=\"m12 8 4.74-2.85\" /><path d=\"M12 13.5V8\" />",
  "Braces": "<path d=\"M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1\" /><path d=\"M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1\" />",
  "Briefcase": "<path d=\"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\" /><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\" />",
  "BriefcaseMedical": "<path d=\"M12 11v4\" /><path d=\"M14 13h-4\" /><path d=\"M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2\" /><path d=\"M18 6v14\" /><path d=\"M6 6v14\" /><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\" />",
  "Bug": "<path d=\"m8 2 1.88 1.88\" /><path d=\"M14.12 3.88 16 2\" /><path d=\"M9 7.13v-1a3.003 3.003 0 1 1 6 0v1\" /><path d=\"M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6\" /><path d=\"M12 20v-9\" /><path d=\"M6.53 9C4.6 8.8 3 7.1 3 5\" /><path d=\"M6 13H2\" /><path d=\"M3 21c0-2.1 1.7-3.9 3.8-4\" /><path d=\"M20.97 5c0 2.1-1.6 3.8-3.5 4\" /><path d=\"M22 13h-4\" /><path d=\"M17.2 17c2.1.1 3.8 1.9 3.8 4\" />",
  "CalendarDays": "<path d=\"M8 2v4\" /><path d=\"M16 2v4\" /><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" /><path d=\"M3 10h18\" /><path d=\"M8 14h.01\" /><path d=\"M12 14h.01\" /><path d=\"M16 14h.01\" /><path d=\"M8 18h.01\" /><path d=\"M12 18h.01\" /><path d=\"M16 18h.01\" />",
  "Car": "<path d=\"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2\" /><circle cx=\"7\" cy=\"17\" r=\"2\" /><path d=\"M9 17h6\" /><circle cx=\"17\" cy=\"17\" r=\"2\" />",
  "Check": "<path d=\"M20 6 9 17l-5-5\" />",
  "CheckCheck": "<path d=\"M18 6 7 17l-5-5\" /><path d=\"m22 10-7.5 7.5L13 16\" />",
  "CheckCircle2": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m9 12 2 2 4-4\" />",
  "ChevronDown": "<path d=\"m6 9 6 6 6-6\" />",
  "ChevronLeft": "<path d=\"m15 18-6-6 6-6\" />",
  "ChevronRight": "<path d=\"m9 18 6-6-6-6\" />",
  "ChevronUp": "<path d=\"m18 15-6-6-6 6\" />",
  "ChevronsUpDown": "<path d=\"m7 15 5 5 5-5\" /><path d=\"m7 9 5-5 5 5\" />",
  "Circle": "<circle cx=\"12\" cy=\"12\" r=\"10\" />",
  "CircleAlert": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\" /><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\" />",
  "CircleDot": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><circle cx=\"12\" cy=\"12\" r=\"1\" />",
  "CircleHelp": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\" /><path d=\"M12 17h.01\" />",
  "CirclePause": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><line x1=\"10\" x2=\"10\" y1=\"15\" y2=\"9\" /><line x1=\"14\" x2=\"14\" y1=\"15\" y2=\"9\" />",
  "CirclePlay": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><polygon points=\"10 8 16 12 10 16 10 8\" />",
  "CirclePlus": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M8 12h8\" /><path d=\"M12 8v8\" />",
  "CircleUserRound": "<path d=\"M18 20a6 6 0 0 0-12 0\" /><circle cx=\"12\" cy=\"10\" r=\"4\" /><circle cx=\"12\" cy=\"12\" r=\"10\" />",
  "ClipboardCheck": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /><path d=\"m9 14 2 2 4-4\" />",
  "ClipboardList": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /><path d=\"M12 11h4\" /><path d=\"M12 16h4\" /><path d=\"M8 11h.01\" /><path d=\"M8 16h.01\" />",
  "ClipboardPlus": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /><path d=\"M9 14h6\" /><path d=\"M12 17v-6\" />",
  "Clock": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><polyline points=\"12 6 12 12 16 14\" />",
  "Cloud": "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" />",
  "CloudOff": "<path d=\"m2 2 20 20\" /><path d=\"M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193\" /><path d=\"M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07\" />",
  "Code": "<polyline points=\"16 18 22 12 16 6\" /><polyline points=\"8 6 2 12 8 18\" />",
  "Coins": "<circle cx=\"8\" cy=\"8\" r=\"6\" /><path d=\"M18.09 10.37A6 6 0 1 1 10.34 18\" /><path d=\"M7 6h1v4\" /><path d=\"m16.71 13.88.7.71-2.82 2.82\" />",
  "Columns3": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M9 3v18\" /><path d=\"M15 3v18\" />",
  "CornerDownLeft": "<polyline points=\"9 10 4 15 9 20\" /><path d=\"M20 4v7a4 4 0 0 1-4 4H4\" />",
  "Cpu": "<rect width=\"16\" height=\"16\" x=\"4\" y=\"4\" rx=\"2\" /><rect width=\"6\" height=\"6\" x=\"9\" y=\"9\" rx=\"1\" /><path d=\"M15 2v2\" /><path d=\"M15 20v2\" /><path d=\"M2 15h2\" /><path d=\"M2 9h2\" /><path d=\"M20 15h2\" /><path d=\"M20 9h2\" /><path d=\"M9 2v2\" /><path d=\"M9 20v2\" />",
  "Database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" /><path d=\"M3 5V19A9 3 0 0 0 21 19V5\" /><path d=\"M3 12A9 3 0 0 0 21 12\" />",
  "DatabaseZap": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" /><path d=\"M3 5V19A9 3 0 0 0 15 21.84\" /><path d=\"M21 5V8\" /><path d=\"M21 12L18 17H22L19 22\" /><path d=\"M3 12A9 3 0 0 0 14.59 14.87\" />",
  "DoorOpen": "<path d=\"M13 4h3a2 2 0 0 1 2 2v14\" /><path d=\"M2 20h3\" /><path d=\"M13 20h9\" /><path d=\"M10 12v.01\" /><path d=\"M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z\" />",
  "Download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><polyline points=\"7 10 12 15 17 10\" /><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\" />",
  "Dumbbell": "<path d=\"M14.4 14.4 9.6 9.6\" /><path d=\"M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z\" /><path d=\"m21.5 21.5-1.4-1.4\" /><path d=\"M3.9 3.9 2.5 2.5\" /><path d=\"M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z\" />",
  "Ellipsis": "<circle cx=\"12\" cy=\"12\" r=\"1\" /><circle cx=\"19\" cy=\"12\" r=\"1\" /><circle cx=\"5\" cy=\"12\" r=\"1\" />",
  "EllipsisVertical": "<circle cx=\"12\" cy=\"12\" r=\"1\" /><circle cx=\"12\" cy=\"5\" r=\"1\" /><circle cx=\"12\" cy=\"19\" r=\"1\" />",
  "Expand": "<path d=\"m21 21-6-6m6 6v-4.8m0 4.8h-4.8\" /><path d=\"M3 16.2V21m0 0h4.8M3 21l6-6\" /><path d=\"M21 7.8V3m0 0h-4.8M21 3l-6 6\" /><path d=\"M3 7.8V3m0 0h4.8M3 3l6 6\" />",
  "ExternalLink": "<path d=\"M15 3h6v6\" /><path d=\"M10 14 21 3\" /><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\" />",
  "Eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "EyeOff": "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\" /><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\" /><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\" /><path d=\"m2 2 20 20\" />",
  "Factory": "<path d=\"M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z\" /><path d=\"M17 18h1\" /><path d=\"M12 18h1\" /><path d=\"M7 18h1\" />",
  "FastForward": "<polygon points=\"13 19 22 12 13 5 13 19\" /><polygon points=\"2 19 11 12 2 5 2 19\" />",
  "FilePenLine": "<path d=\"m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2\" /><path d=\"M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\" /><path d=\"M8 18h1\" />",
  "FileText": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /><path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /><path d=\"M10 9H8\" /><path d=\"M16 13H8\" /><path d=\"M16 17H8\" />",
  "FileWarning": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /><path d=\"M12 9v4\" /><path d=\"M12 17h.01\" />",
  "Filter": "<polygon points=\"22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3\" />",
  "FilterX": "<path d=\"M13.013 3H2l8 9.46V19l4 2v-8.54l.9-1.055\" /><path d=\"m22 3-5 5\" /><path d=\"m17 3 5 5\" />",
  "Flag": "<path d=\"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z\" /><line x1=\"4\" x2=\"4\" y1=\"22\" y2=\"15\" />",
  "Flame": "<path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\" />",
  "FlaskConical": "<path d=\"M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2\" /><path d=\"M6.453 15h11.094\" /><path d=\"M8.5 2h7\" />",
  "FolderOpen": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\" />",
  "FolderX": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\" /><path d=\"m9.5 10.5 5 5\" /><path d=\"m14.5 10.5-5 5\" />",
  "Fuel": "<line x1=\"3\" x2=\"15\" y1=\"22\" y2=\"22\" /><line x1=\"4\" x2=\"14\" y1=\"9\" y2=\"9\" /><path d=\"M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18\" /><path d=\"M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5\" />",
  "Gamepad2": "<line x1=\"6\" x2=\"10\" y1=\"11\" y2=\"11\" /><line x1=\"8\" x2=\"8\" y1=\"9\" y2=\"13\" /><line x1=\"15\" x2=\"15.01\" y1=\"12\" y2=\"12\" /><line x1=\"18\" x2=\"18.01\" y1=\"10\" y2=\"10\" /><path d=\"M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z\" />",
  "Gauge": "<path d=\"m12 14 4-4\" /><path d=\"M3.34 19a10 10 0 1 1 17.32 0\" />",
  "Gavel": "<path d=\"m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8\" /><path d=\"m16 16 6-6\" /><path d=\"m8 8 6-6\" /><path d=\"m9 7 8 8\" /><path d=\"m21 11-8-8\" />",
  "GitBranch": "<line x1=\"6\" x2=\"6\" y1=\"3\" y2=\"15\" /><circle cx=\"18\" cy=\"6\" r=\"3\" /><circle cx=\"6\" cy=\"18\" r=\"3\" /><path d=\"M18 9a9 9 0 0 1-9 9\" />",
  "GitCompareArrows": "<circle cx=\"5\" cy=\"6\" r=\"3\" /><path d=\"M12 6h5a2 2 0 0 1 2 2v7\" /><path d=\"m15 9-3-3 3-3\" /><circle cx=\"19\" cy=\"18\" r=\"3\" /><path d=\"M12 18H7a2 2 0 0 1-2-2V9\" /><path d=\"m9 15 3 3-3 3\" />",
  "Grid3X3": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M3 9h18\" /><path d=\"M3 15h18\" /><path d=\"M9 3v18\" /><path d=\"M15 3v18\" />",
  "GripHorizontal": "<circle cx=\"12\" cy=\"9\" r=\"1\" /><circle cx=\"19\" cy=\"9\" r=\"1\" /><circle cx=\"5\" cy=\"9\" r=\"1\" /><circle cx=\"12\" cy=\"15\" r=\"1\" /><circle cx=\"19\" cy=\"15\" r=\"1\" /><circle cx=\"5\" cy=\"15\" r=\"1\" />",
  "GripVertical": "<circle cx=\"9\" cy=\"12\" r=\"1\" /><circle cx=\"9\" cy=\"5\" r=\"1\" /><circle cx=\"9\" cy=\"19\" r=\"1\" /><circle cx=\"15\" cy=\"12\" r=\"1\" /><circle cx=\"15\" cy=\"5\" r=\"1\" /><circle cx=\"15\" cy=\"19\" r=\"1\" />",
  "HardHat": "<path d=\"M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5\" /><path d=\"M14 6a6 6 0 0 1 6 6v3\" /><path d=\"M4 15v-3a6 6 0 0 1 6-6\" /><rect x=\"2\" y=\"15\" width=\"20\" height=\"4\" rx=\"1\" />",
  "Headphones": "<path d=\"M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3\" />",
  "Heart": "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\" />",
  "HeartPulse": "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\" /><path d=\"M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\" />",
  "History": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /><path d=\"M3 3v5h5\" /><path d=\"M12 7v5l4 2\" />",
  "Home": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" /><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />",
  "Hospital": "<path d=\"M12 6v4\" /><path d=\"M14 14h-4\" /><path d=\"M14 18h-4\" /><path d=\"M14 8h-4\" /><path d=\"M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2\" /><path d=\"M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18\" />",
  "Inbox": "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\" /><path d=\"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\" />",
  "Info": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" />",
  "Kanban": "<path d=\"M6 5v11\" /><path d=\"M12 5v6\" /><path d=\"M18 5v14\" />",
  "Key": "<path d=\"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4\" /><path d=\"m21 2-9.6 9.6\" /><circle cx=\"7.5\" cy=\"15.5\" r=\"5.5\" />",
  "Keyboard": "<path d=\"M10 8h.01\" /><path d=\"M12 12h.01\" /><path d=\"M14 8h.01\" /><path d=\"M16 12h.01\" /><path d=\"M18 8h.01\" /><path d=\"M6 8h.01\" /><path d=\"M7 16h10\" /><path d=\"M8 12h.01\" /><rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\" />",
  "Languages": "<path d=\"m5 8 6 6\" /><path d=\"m4 14 6-6 2-3\" /><path d=\"M2 5h12\" /><path d=\"M7 2h1\" /><path d=\"m22 22-5-10-5 10\" /><path d=\"M14 18h6\" />",
  "Layers": "<path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\" /><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\" /><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\" />",
  "LayoutDashboard": "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" />",
  "LayoutGrid": "<rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\" /><rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\" />",
  "Lightbulb": "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\" /><path d=\"M9 18h6\" /><path d=\"M10 22h4\" />",
  "List": "<path d=\"M3 12h.01\" /><path d=\"M3 18h.01\" /><path d=\"M3 6h.01\" /><path d=\"M8 12h13\" /><path d=\"M8 18h13\" /><path d=\"M8 6h13\" />",
  "ListChecks": "<path d=\"m3 17 2 2 4-4\" /><path d=\"m3 7 2 2 4-4\" /><path d=\"M13 6h8\" /><path d=\"M13 12h8\" /><path d=\"M13 18h8\" />",
  "ListFilter": "<path d=\"M3 6h18\" /><path d=\"M7 12h10\" /><path d=\"M10 18h4\" />",
  "ListOrdered": "<path d=\"M10 12h11\" /><path d=\"M10 18h11\" /><path d=\"M10 6h11\" /><path d=\"M4 10h2\" /><path d=\"M4 6h1v4\" /><path d=\"M6 18H4c0-1 2-2 2-3s-1-1.5-2-1\" />",
  "ListTodo": "<rect x=\"3\" y=\"5\" width=\"6\" height=\"6\" rx=\"1\" /><path d=\"m3 17 2 2 4-4\" /><path d=\"M13 6h8\" /><path d=\"M13 12h8\" /><path d=\"M13 18h8\" />",
  "ListX": "<path d=\"M11 12H3\" /><path d=\"M16 6H3\" /><path d=\"M16 18H3\" /><path d=\"m19 10-4 4\" /><path d=\"m15 10 4 4\" />",
  "LoaderCircle": "<path d=\"M21 12a9 9 0 1 1-6.219-8.56\" />",
  "LogIn": "<path d=\"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4\" /><polyline points=\"10 17 15 12 10 7\" /><line x1=\"15\" x2=\"3\" y1=\"12\" y2=\"12\" />",
  "LogOut": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" /><polyline points=\"16 17 21 12 16 7\" /><line x1=\"21\" x2=\"9\" y1=\"12\" y2=\"12\" />",
  "Mail": "<rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\" /><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\" />",
  "Map": "<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\" /><path d=\"M15 5.764v15\" /><path d=\"M9 3.236v15\" />",
  "MapPin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\" /><circle cx=\"12\" cy=\"10\" r=\"3\" />",
  "Menu": "<line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\" /><line x1=\"4\" x2=\"20\" y1=\"6\" y2=\"6\" /><line x1=\"4\" x2=\"20\" y1=\"18\" y2=\"18\" />",
  "Mic": "<path d=\"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z\" /><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\" /><line x1=\"12\" x2=\"12\" y1=\"19\" y2=\"22\" />",
  "Minus": "<path d=\"M5 12h14\" />",
  "Monitor": "<rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\" /><line x1=\"8\" x2=\"16\" y1=\"21\" y2=\"21\" /><line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"21\" />",
  "MonitorCog": "<path d=\"M12 17v4\" /><path d=\"m15.2 4.9-.9-.4\" /><path d=\"m15.2 7.1-.9.4\" /><path d=\"m16.9 3.2-.4-.9\" /><path d=\"m16.9 8.8-.4.9\" /><path d=\"m19.5 2.3-.4.9\" /><path d=\"m19.5 9.7-.4-.9\" /><path d=\"m21.7 4.5-.9.4\" /><path d=\"m21.7 7.5-.9-.4\" /><path d=\"M22 13v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7\" /><path d=\"M8 21h8\" /><circle cx=\"18\" cy=\"6\" r=\"3\" />",
  "Mountain": "<path d=\"m8 3 4 8 5-5 5 15H2L8 3z\" />",
  "MousePointerClick": "<path d=\"M14 4.1 12 6\" /><path d=\"m5.1 8-2.9-.8\" /><path d=\"m6 12-1.9 2\" /><path d=\"M7.2 2.2 8 5.1\" /><path d=\"M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z\" />",
  "MoveDownRight": "<path d=\"M19 13V19H13\" /><path d=\"M5 5L19 19\" />",
  "Music": "<path d=\"M9 18V5l12-2v13\" /><circle cx=\"6\" cy=\"18\" r=\"3\" /><circle cx=\"18\" cy=\"16\" r=\"3\" />",
  "Navigation": "<polygon points=\"3 11 22 2 13 21 11 13 3 11\" />",
  "Network": "<rect x=\"16\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\" /><rect x=\"2\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\" /><rect x=\"9\" y=\"2\" width=\"6\" height=\"6\" rx=\"1\" /><path d=\"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3\" /><path d=\"M12 12V8\" />",
  "Package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\" /><path d=\"M12 22V12\" /><path d=\"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7\" /><path d=\"m7.5 4.27 9 5.15\" />",
  "PackageCheck": "<path d=\"m16 16 2 2 4-4\" /><path d=\"M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14\" /><path d=\"m7.5 4.27 9 5.15\" /><polyline points=\"3.29 7 12 12 20.71 7\" /><line x1=\"12\" x2=\"12\" y1=\"22\" y2=\"12\" />",
  "PackageSearch": "<path d=\"M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14\" /><path d=\"m7.5 4.27 9 5.15\" /><polyline points=\"3.29 7 12 12 20.71 7\" /><line x1=\"12\" x2=\"12\" y1=\"22\" y2=\"12\" /><circle cx=\"18.5\" cy=\"15.5\" r=\"2.5\" /><path d=\"M20.27 17.27 22 19\" />",
  "Palette": "<circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\" /><circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\" /><circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" /><circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\" /><path d=\"M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z\" />",
  "Pause": "<rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" /><rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" />",
  "Pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /><path d=\"m15 5 4 4\" />",
  "Phone": "<path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z\" />",
  "PhoneCall": "<path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z\" /><path d=\"M14.05 2a9 9 0 0 1 8 7.94\" /><path d=\"M14.05 6A5 5 0 0 1 18 10\" />",
  "PieChart": "<path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\" /><path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" />",
  "Plane": "<path d=\"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z\" />",
  "PlaneLanding": "<path d=\"M2 22h20\" /><path d=\"M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z\" />",
  "PlaneTakeoff": "<path d=\"M2 22h20\" /><path d=\"M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z\" />",
  "Play": "<polygon points=\"6 3 20 12 6 21 6 3\" />",
  "Plus": "<path d=\"M5 12h14\" /><path d=\"M12 5v14\" />",
  "PlusSquare": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M8 12h8\" /><path d=\"M12 8v8\" />",
  "Power": "<path d=\"M12 2v10\" /><path d=\"M18.4 6.6a9 9 0 1 1-12.77.04\" />",
  "RadioTower": "<path d=\"M4.9 16.1C1 12.2 1 5.8 4.9 1.9\" /><path d=\"M7.8 4.7a6.14 6.14 0 0 0-.8 7.5\" /><circle cx=\"12\" cy=\"9\" r=\"2\" /><path d=\"M16.2 4.8c2 2 2.26 5.11.8 7.47\" /><path d=\"M19.1 1.9a9.96 9.96 0 0 1 0 14.1\" /><path d=\"M9.5 18h5\" /><path d=\"m8 22 4-11 4 11\" />",
  "RefreshCcw": "<path d=\"M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /><path d=\"M3 3v5h5\" /><path d=\"M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16\" /><path d=\"M16 16h5v5\" />",
  "RefreshCw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" />",
  "RefreshCwOff": "<path d=\"M21 8L18.74 5.74A9.75 9.75 0 0 0 12 3C11 3 10.03 3.16 9.13 3.47\" /><path d=\"M8 16H3v5\" /><path d=\"M3 12C3 9.51 4 7.26 5.64 5.64\" /><path d=\"m3 16 2.26 2.26A9.75 9.75 0 0 0 12 21c2.49 0 4.74-1 6.36-2.64\" /><path d=\"M21 12c0 1-.16 1.97-.47 2.87\" /><path d=\"M21 3v5h-5\" /><path d=\"M22 22 2 2\" />",
  "Rocket": "<path d=\"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z\" /><path d=\"m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z\" /><path d=\"M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0\" /><path d=\"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5\" />",
  "RotateCcw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /><path d=\"M3 3v5h5\" />",
  "RotateCw": "<path d=\"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" />",
  "Route": "<circle cx=\"6\" cy=\"19\" r=\"3\" /><path d=\"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15\" /><circle cx=\"18\" cy=\"5\" r=\"3\" />",
  "Router": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" /><path d=\"M6.01 18H6\" /><path d=\"M10.01 18H10\" /><path d=\"M15 10v4\" /><path d=\"M17.84 7.17a4 4 0 0 0-5.66 0\" /><path d=\"M20.66 4.34a8 8 0 0 0-11.31 0\" />",
  "Rows2": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M3 12h18\" />",
  "Rows3": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M21 9H3\" /><path d=\"M21 15H3\" />",
  "Ruler": "<path d=\"M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z\" /><path d=\"m14.5 12.5 2-2\" /><path d=\"m11.5 9.5 2-2\" /><path d=\"m8.5 6.5 2-2\" /><path d=\"m17.5 15.5 2-2\" />",
  "Save": "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\" /><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\" /><path d=\"M7 3v4a1 1 0 0 0 1 1h7\" />",
  "Search": "<circle cx=\"11\" cy=\"11\" r=\"8\" /><path d=\"m21 21-4.3-4.3\" />",
  "SearchX": "<path d=\"m13.5 8.5-5 5\" /><path d=\"m8.5 8.5 5 5\" /><circle cx=\"11\" cy=\"11\" r=\"8\" /><path d=\"m21 21-4.3-4.3\" />",
  "Server": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"2\" rx=\"2\" ry=\"2\" /><rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" ry=\"2\" /><line x1=\"6\" x2=\"6.01\" y1=\"6\" y2=\"6\" /><line x1=\"6\" x2=\"6.01\" y1=\"18\" y2=\"18\" />",
  "Settings": "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "Settings2": "<path d=\"M20 7h-9\" /><path d=\"M14 17H5\" /><circle cx=\"17\" cy=\"17\" r=\"3\" /><circle cx=\"7\" cy=\"7\" r=\"3\" />",
  "Shapes": "<path d=\"M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z\" /><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\" /><circle cx=\"17.5\" cy=\"17.5\" r=\"3.5\" />",
  "Shield": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" />",
  "ShieldAlert": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /><path d=\"M12 8v4\" /><path d=\"M12 16h.01\" />",
  "SlidersHorizontal": "<line x1=\"21\" x2=\"14\" y1=\"4\" y2=\"4\" /><line x1=\"10\" x2=\"3\" y1=\"4\" y2=\"4\" /><line x1=\"21\" x2=\"12\" y1=\"12\" y2=\"12\" /><line x1=\"8\" x2=\"3\" y1=\"12\" y2=\"12\" /><line x1=\"21\" x2=\"16\" y1=\"20\" y2=\"20\" /><line x1=\"12\" x2=\"3\" y1=\"20\" y2=\"20\" /><line x1=\"14\" x2=\"14\" y1=\"2\" y2=\"6\" /><line x1=\"8\" x2=\"8\" y1=\"10\" y2=\"14\" /><line x1=\"16\" x2=\"16\" y1=\"18\" y2=\"22\" />",
  "Smartphone": "<rect width=\"14\" height=\"20\" x=\"5\" y=\"2\" rx=\"2\" ry=\"2\" /><path d=\"M12 18h.01\" />",
  "Smile": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M8 14s1.5 2 4 2 4-2 4-2\" /><line x1=\"9\" x2=\"9.01\" y1=\"9\" y2=\"9\" /><line x1=\"15\" x2=\"15.01\" y1=\"9\" y2=\"9\" />",
  "Space": "<path d=\"M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1\" />",
  "Sparkles": "<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\" /><path d=\"M20 3v4\" /><path d=\"M22 5h-4\" /><path d=\"M4 17v2\" /><path d=\"M5 18H3\" />",
  "Star": "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />",
  "StickyNote": "<path d=\"M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z\" /><path d=\"M15 3v4a2 2 0 0 0 2 2h4\" />",
  "Swords": "<polyline points=\"14.5 17.5 3 6 3 3 6 3 17.5 14.5\" /><line x1=\"13\" x2=\"19\" y1=\"19\" y2=\"13\" /><line x1=\"16\" x2=\"20\" y1=\"16\" y2=\"20\" /><line x1=\"19\" x2=\"21\" y1=\"21\" y2=\"19\" /><polyline points=\"14.5 6.5 18 3 21 3 21 6 17.5 9.5\" /><line x1=\"5\" x2=\"9\" y1=\"14\" y2=\"18\" /><line x1=\"7\" x2=\"4\" y1=\"17\" y2=\"20\" /><line x1=\"3\" x2=\"5\" y1=\"19\" y2=\"21\" />",
  "Tag": "<path d=\"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\" /><circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
  "Terminal": "<polyline points=\"4 17 10 11 4 5\" /><line x1=\"12\" x2=\"20\" y1=\"19\" y2=\"19\" />",
  "Timer": "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" /><line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" /><circle cx=\"12\" cy=\"14\" r=\"8\" />",
  "ToggleRight": "<rect width=\"20\" height=\"12\" x=\"2\" y=\"6\" rx=\"6\" ry=\"6\" /><circle cx=\"16\" cy=\"12\" r=\"2\" />",
  "Train": "<rect width=\"16\" height=\"16\" x=\"4\" y=\"3\" rx=\"2\" /><path d=\"M4 11h16\" /><path d=\"M12 3v8\" /><path d=\"m8 19-2 3\" /><path d=\"m18 22-2-3\" /><path d=\"M8 15h.01\" /><path d=\"M16 15h.01\" />",
  "Trash2": "<path d=\"M3 6h18\" /><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\" /><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\" /><line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\" /><line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\" />",
  "TrendingUp": "<polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\" /><polyline points=\"16 7 22 7 22 13\" />",
  "Triangle": "<path d=\"M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" />",
  "TriangleAlert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /><path d=\"M12 9v4\" /><path d=\"M12 17h.01\" />",
  "Trophy": "<path d=\"M6 9H4.5a2.5 2.5 0 0 1 0-5H6\" /><path d=\"M18 9h1.5a2.5 2.5 0 0 0 0-5H18\" /><path d=\"M4 22h16\" /><path d=\"M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22\" /><path d=\"M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22\" /><path d=\"M18 2H6v7a6 6 0 0 0 12 0V2Z\" />",
  "Truck": "<path d=\"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\" /><path d=\"M15 18H9\" /><path d=\"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14\" /><circle cx=\"17\" cy=\"18\" r=\"2\" /><circle cx=\"7\" cy=\"18\" r=\"2\" />",
  "Type": "<polyline points=\"4 7 4 4 20 4 20 7\" /><line x1=\"9\" x2=\"15\" y1=\"20\" y2=\"20\" /><line x1=\"12\" x2=\"12\" y1=\"4\" y2=\"20\" />",
  "User": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\" /><circle cx=\"12\" cy=\"7\" r=\"4\" />",
  "UserCheck": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /><circle cx=\"9\" cy=\"7\" r=\"4\" /><polyline points=\"16 11 18 13 22 9\" />",
  "UserMinus": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /><circle cx=\"9\" cy=\"7\" r=\"4\" /><line x1=\"22\" x2=\"16\" y1=\"11\" y2=\"11\" />",
  "UserPlus": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /><circle cx=\"9\" cy=\"7\" r=\"4\" /><line x1=\"19\" x2=\"19\" y1=\"8\" y2=\"14\" /><line x1=\"22\" x2=\"16\" y1=\"11\" y2=\"11\" />",
  "UserSearch": "<circle cx=\"10\" cy=\"7\" r=\"4\" /><path d=\"M10.3 15H7a4 4 0 0 0-4 4v2\" /><circle cx=\"17\" cy=\"17\" r=\"3\" /><path d=\"m21 21-1.9-1.9\" />",
  "Users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /><circle cx=\"9\" cy=\"7\" r=\"4\" /><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" /><path d=\"M16 3.13a4 4 0 0 1 0 7.75\" />",
  "UsersRound": "<path d=\"M18 21a8 8 0 0 0-16 0\" /><circle cx=\"10\" cy=\"8\" r=\"5\" /><path d=\"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3\" />",
  "Vibrate": "<path d=\"m2 8 2 2-2 2 2 2-2 2\" /><path d=\"m22 8-2 2 2 2-2 2 2 2\" /><rect width=\"8\" height=\"14\" x=\"8\" y=\"5\" rx=\"1\" />",
  "Volume1": "<path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" /><path d=\"M16 9a5 5 0 0 1 0 6\" />",
  "Volume2": "<path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" /><path d=\"M16 9a5 5 0 0 1 0 6\" /><path d=\"M19.364 18.364a9 9 0 0 0 0-12.728\" />",
  "VolumeX": "<path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" /><line x1=\"22\" x2=\"16\" y1=\"9\" y2=\"15\" /><line x1=\"16\" x2=\"22\" y1=\"9\" y2=\"15\" />",
  "Warehouse": "<path d=\"M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z\" /><path d=\"M6 18h12\" /><path d=\"M6 14h12\" /><rect width=\"12\" height=\"12\" x=\"6\" y=\"10\" />",
  "Wifi": "<path d=\"M12 20h.01\" /><path d=\"M2 8.82a15 15 0 0 1 20 0\" /><path d=\"M5 12.859a10 10 0 0 1 14 0\" /><path d=\"M8.5 16.429a5 5 0 0 1 7 0\" />",
  "WifiOff": "<path d=\"M12 20h.01\" /><path d=\"M8.5 16.429a5 5 0 0 1 7 0\" /><path d=\"M5 12.859a10 10 0 0 1 5.17-2.69\" /><path d=\"M19 12.859a10 10 0 0 0-2.007-1.523\" /><path d=\"M2 8.82a15 15 0 0 1 4.177-2.643\" /><path d=\"M22 8.82a15 15 0 0 0-11.288-3.764\" /><path d=\"m2 2 20 20\" />",
  "Wrench": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\" />",
  "X": "<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />",
  "Zap": "<path d=\"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z\" />",
});

const INTRINSIC_ICON_FALLBACK_BODY =
  '<circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.75-2.5 2-2.5 4" /><path d="M12 17h.01" />';

function materialIconKey(inner) {
  return textFromHtml(inner).toLowerCase().replace(/\s+/g, "_");
}

function normalizeClassTokens(classValue) {
  const tokens = String(classValue || "")
    .split(/\s+/)
    .map(cls => (cls === "transition-all" ? "transition-colors" : cls))
    .filter(Boolean);

  return normalizeSceneBackgroundRepeat(normalizePositionedFullWidth(tokens)).join(" ");
}

function normalizeSceneBackgroundRepeat(tokens) {
  const normalized = [...tokens];
  const parsed = normalized.map((token) => ({ token, ...splitTailwindVariant(token) }));
  const hasSceneImage = parsed.some(({ base }) => /^bg-\[url\(.+\)\]$/.test(base));
  const hasSceneSizing = parsed.some(({ base }) => ["bg-cover", "bg-contain"].includes(base));
  const hasRepeatPolicy = parsed.some(({ base }) => /^bg-(?:no-repeat|repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/.test(base));
  if (hasSceneImage && hasSceneSizing && !hasRepeatPolicy) normalized.push("bg-no-repeat");
  return normalized;
}

function splitTailwindVariant(token) {
  let depth = 0;
  let splitAt = -1;
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i];
    if (ch === "[") depth += 1;
    if (ch === "]") depth = Math.max(0, depth - 1);
    if (ch === ":" && depth === 0) splitAt = i;
  }
  if (splitAt === -1) return { variant: "", base: token };
  return { variant: token.slice(0, splitAt), base: token.slice(splitAt + 1) };
}

function splitVariantParts(variant) {
  if (!variant) return [];
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < variant.length; i += 1) {
    const ch = variant[i];
    if (ch === "[") depth += 1;
    if (ch === "]") depth = Math.max(0, depth - 1);
    if (ch === ":" && depth === 0) {
      parts.push(variant.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(variant.slice(start));
  return parts.filter(Boolean);
}

function wrapResponsiveVariant(rule, variantParts) {
  const screens = {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  };
  const responsive = variantParts.find(part => screens[part]);
  return responsive ? `@media (min-width: ${screens[responsive]}) { ${rule} }` : rule;
}

function selectorForClassVariant(cls, variant) {
  const parts = splitVariantParts(variant);
  let prefix = "";
  let pseudo = "";
  for (const part of parts) {
    if (part === "dark") prefix += ".dark ";
    if (part === "group-hover") prefix += ".group:hover ";
    if (part === "hover") pseudo += ":hover";
    if (part === "focus") pseudo += ":focus";
    if (part === "focus-visible") pseudo += ":focus-visible";
    if (part === "focus-within") pseudo += ":focus-within";
    if (part === "active") pseudo += ":active";
    if (part === "disabled") pseudo += ":disabled";
    if (part === "visited") pseudo += ":visited";
  }
  return {
    selector: `${prefix}.${cssEscapeSelector(cls)}${pseudo}`,
    variantParts: parts,
  };
}

function normalizePositionedFullWidth(tokens) {
  const parsed = tokens.map((token) => ({ token, ...splitTailwindVariant(token) }));
  const isPositioned = parsed.some(({ base }) => base === "fixed" || base === "absolute");
  if (!isPositioned) return tokens;

  const insetByVariant = new Map();
  for (const { variant, base } of parsed) {
    if (!insetByVariant.has(variant)) insetByVariant.set(variant, { left: false, right: false });
    const entry = insetByVariant.get(variant);
    if (/^-?left-(?:\[|[a-z0-9/.-])/.test(base)) entry.left = true;
    if (/^-?right-(?:\[|[a-z0-9/.-])/.test(base)) entry.right = true;
  }

  const hasInsetPair = (variant) => {
    const exact = insetByVariant.get(variant);
    const base = insetByVariant.get("");
    return Boolean((exact && exact.left && exact.right) || (variant && base && base.left && base.right));
  };

  return parsed
    .filter(({ variant, base }) => {
      if (!["w-full", "w-screen", "min-w-full", "min-w-screen"].includes(base)) return true;
      return !hasInsetPair(variant);
    })
    .map(({ token }) => token);
}

function normalizeDesignClassAttributes(html) {
  return String(html || "").replace(
    /\b(class|className)=("([^"]*)"|'([^']*)')/gi,
    (_match, attr, quoted, doubleValue, singleValue) => {
      const quote = quoted.startsWith('"') ? '"' : "'";
      const value = doubleValue ?? singleValue ?? "";
      return `${attr}=${quote}${normalizeClassTokens(value)}${quote}`;
    },
  );
}

function collectClassTokens(html, out) {
  String(html || "").replace(/\b(?:class|className)=("([^"]*)"|'([^']*)')/gi, (_match, _quoted, doubleValue, singleValue) => {
    const value = doubleValue ?? singleValue ?? "";
    normalizeClassTokens(value).split(/\s+/).forEach(cls => {
      if (cls) out.add(cls);
    });
    return "";
  });
}

const STITCH_RUNTIME_CSS_START = "/* SETFARM_STITCH_RUNTIME_UTILITIES_START */";
const STITCH_RUNTIME_CSS_END = "/* SETFARM_STITCH_RUNTIME_UTILITIES_END */";
const STITCH_CUSTOM_CSS_START = "/* SETFARM_STITCH_CUSTOM_CSS_START */";
const STITCH_CUSTOM_CSS_END = "/* SETFARM_STITCH_CUSTOM_CSS_END */";

function cssEscapeSelector(cls) {
  return cls.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function parseDesignTokensCss(css) {
  const tokens = { colors: new Set(), fonts: new Set(), radii: new Set(), spacing: new Set() };
  String(css || "").replace(/--(color|font|radius|spacing)-([a-zA-Z0-9_-]+)\s*:/g, (_match, kind, key) => {
    if (kind === "color") tokens.colors.add(key);
    if (kind === "font") tokens.fonts.add(key);
    if (kind === "radius") tokens.radii.add(key);
    if (kind === "spacing") tokens.spacing.add(key);
    return "";
  });
  return tokens;
}

function designTokensForRepo(repoPath) {
  const stitchTokensPath = path.join(repoPath, "stitch", "design-tokens.css");
  if (!fs.existsSync(stitchTokensPath)) return parseDesignTokensCss("");
  return parseDesignTokensCss(fs.readFileSync(stitchTokensPath, "utf-8"));
}

function tokenColorValue(key, opacity) {
  const value = `var(--color-${key})`;
  if (!opacity) return value;
  const pct = Math.max(0, Math.min(100, Number(opacity)));
  if (!Number.isFinite(pct)) return value;
  return `color-mix(in srgb, ${value} ${pct}%, transparent)`;
}

function splitOpacityToken(value) {
  const match = String(value || "").match(/^([a-zA-Z0-9_-]+)(?:\/(\d{1,3}))?$/);
  return match ? { key: match[1], opacity: match[2] || "" } : null;
}

function buildDesignTokenUtilityRule(baseClass, selector, tokens) {
  const colorPrefixes = [
    ["bg-", "background-color"],
    ["text-", "color"],
    ["border-", "border-color"],
    ["outline-", "outline-color"],
    ["divide-", "border-color"],
    ["accent-", "accent-color"],
    ["caret-", "caret-color"],
  ];
  for (const [prefix, prop] of colorPrefixes) {
    if (!baseClass.startsWith(prefix)) continue;
    const parsed = splitOpacityToken(baseClass.slice(prefix.length));
    if (parsed && tokens.colors.has(parsed.key)) {
      return `${selector} { ${prop}: ${tokenColorValue(parsed.key, parsed.opacity)}; }`;
    }
  }

  if (baseClass.startsWith("ring-")) {
    const parsed = splitOpacityToken(baseClass.slice("ring-".length));
    if (parsed && tokens.colors.has(parsed.key)) {
      return `${selector} { --tw-ring-color: ${tokenColorValue(parsed.key, parsed.opacity)}; }`;
    }
  }

  if (baseClass.startsWith("font-")) {
    const key = baseClass.slice("font-".length);
    if (tokens.fonts.has(key)) {
      return `${selector} { font-family: var(--font-${key}), sans-serif; }`;
    }
  }

  if (baseClass === "rounded" && tokens.radii.has("DEFAULT")) {
    return `${selector} { border-radius: var(--radius-DEFAULT); }`;
  }
  if (baseClass.startsWith("rounded-")) {
    const key = baseClass.slice("rounded-".length);
    if (tokens.radii.has(key)) {
      return `${selector} { border-radius: var(--radius-${key}); }`;
    }
  }

  const spacingMatch = baseClass.match(/^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left)-([a-zA-Z0-9_-]+)$/);
  if (spacingMatch && tokens.spacing.has(spacingMatch[2])) {
    const value = `var(--spacing-${spacingMatch[2]})`;
    const propMap = {
      p: `padding: ${value}`,
      px: `padding-left: ${value}; padding-right: ${value}`,
      py: `padding-top: ${value}; padding-bottom: ${value}`,
      pt: `padding-top: ${value}`,
      pr: `padding-right: ${value}`,
      pb: `padding-bottom: ${value}`,
      pl: `padding-left: ${value}`,
      m: `margin: ${value}`,
      mx: `margin-left: ${value}; margin-right: ${value}`,
      my: `margin-top: ${value}; margin-bottom: ${value}`,
      mt: `margin-top: ${value}`,
      mr: `margin-right: ${value}`,
      mb: `margin-bottom: ${value}`,
      ml: `margin-left: ${value}`,
      gap: `gap: ${value}`,
      "gap-x": `column-gap: ${value}`,
      "gap-y": `row-gap: ${value}`,
      "space-x": `--tw-space-x-reverse: 0; margin-right: calc(${value} * var(--tw-space-x-reverse)); margin-left: calc(${value} * calc(1 - var(--tw-space-x-reverse)))`,
      "space-y": `--tw-space-y-reverse: 0; margin-top: calc(${value} * calc(1 - var(--tw-space-y-reverse))); margin-bottom: calc(${value} * var(--tw-space-y-reverse))`,
      inset: `inset: ${value}`,
      "inset-x": `left: ${value}; right: ${value}`,
      "inset-y": `top: ${value}; bottom: ${value}`,
      top: `top: ${value}`,
      right: `right: ${value}`,
      bottom: `bottom: ${value}`,
      left: `left: ${value}`,
    };
    return `${selector} { ${propMap[spacingMatch[1]]}; }`;
  }

  return "";
}

function ruleForClass(cls, tokens = parseDesignTokensCss("")) {
  const { variant, base } = splitTailwindVariant(cls);
  const { selector, variantParts } = selectorForClassVariant(cls, variant);
  const tokenRule = buildDesignTokenUtilityRule(base, selector, tokens);
  if (tokenRule) return wrapResponsiveVariant(tokenRule, variantParts);

  const textScale = {
    "text-label-sm": "font-size: 0.75rem; line-height: 1rem;",
    "text-label-md": "font-size: 0.875rem; line-height: 1.25rem;",
    "text-body-md": "font-size: 1rem; line-height: 1.5rem;",
    "text-body-lg": "font-size: 1.125rem; line-height: 1.75rem;",
    "text-headline-md": "font-size: 1.5rem; line-height: 2rem;",
    "text-headline-lg": "font-size: 2rem; line-height: 2.4rem;",
    "text-display-md": "font-size: 2.25rem; line-height: 1.1;",
    "text-display-lg": "font-size: clamp(2.5rem, 7vw, 4.5rem); line-height: 1;",
    "text-display-xl": "font-size: 4.5rem; line-height: 1;",
  };
  if (textScale[base]) return wrapResponsiveVariant(`${selector} { ${textScale[base]} }`, variantParts);

  const fontScale = {
    "font-label-sm": "font-weight: 600; letter-spacing: 0.02em;",
    "font-label-md": "font-weight: 600; letter-spacing: 0.01em;",
    "font-body-md": "font-weight: 400;",
    "font-body-lg": "font-weight: 400;",
    "font-headline-md": "font-weight: 700;",
    "font-headline-lg": "font-weight: 800;",
    "font-display-md": "font-weight: 800;",
    "font-display-lg": "font-weight: 900;",
    "font-display-xl": "font-weight: 900;",
  };
  if (fontScale[base]) return wrapResponsiveVariant(`${selector} { ${fontScale[base]} }`, variantParts);

  const tetromino = base.match(/^tetromino-([iotszjl])$/i);
  if (tetromino) {
    const key = tetromino[1].toLowerCase();
    const colors = {
      i: "#38bdf8",
      o: "#facc15",
      t: "#a855f7",
      s: "#22c55e",
      z: "#f97316",
      j: "#3b82f6",
      l: "#ef4444",
    };
    return `${selector} { background: var(--tetromino-${key}, ${colors[key]}); border: 1px solid color-mix(in srgb, var(--tetromino-${key}, ${colors[key]}) 72%, white); box-shadow: inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -2px 0 rgba(0,0,0,0.24); }`;
  }

  if (base === "ghost-piece") return `${selector} { background: transparent; border: 1px dashed rgba(248,250,252,0.45); opacity: 0.55; }`;
  if (base === "bg-grid") return `${selector} { background-image: linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px); background-size: 24px 24px; }`;
  if (base === "bg-no-repeat") return `${selector} { background-repeat: no-repeat; }`;
  if (base === "machined-border") return `${selector} { border: 1px solid rgba(148,163,184,0.35); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 30px rgba(2,6,23,0.35); }`;
  if (base === "neon-glow-red") return `${selector} { box-shadow: 0 0 0 1px rgba(244,63,94,0.5), 0 0 24px rgba(244,63,94,0.28); }`;
  if (base === "min-touch") return `${selector} { min-width: 44px; min-height: 44px; }`;
  if (base === "h-touch-target") return `${selector} { height: 44px; }`;
  if (base === "w-grid-block") return `${selector} { width: clamp(1.1rem, 5vw, 1.85rem); }`;
  if (base === "h-grid-block") return `${selector} { height: clamp(1.1rem, 5vw, 1.85rem); }`;
  if (base === "px-gutter") return `${selector} { padding-left: clamp(1rem, 4vw, 2rem); padding-right: clamp(1rem, 4vw, 2rem); }`;
  return "";
}

function buildRuntimeUtilityCss(classTokens, tokens = parseDesignTokensCss("")) {
  const rules = [...classTokens].map(cls => ruleForClass(cls, tokens)).filter(Boolean);
  const hasTetromino = [...classTokens].some(cls => /^tetromino-/i.test(cls));
  if (hasTetromino) {
    rules.unshift(
      ":root { --tetromino-i: #38bdf8; --tetromino-o: #facc15; --tetromino-t: #a855f7; --tetromino-s: #22c55e; --tetromino-z: #f97316; --tetromino-j: #3b82f6; --tetromino-l: #ef4444; }",
    );
  }
  if (rules.length === 0) return "";
  return [
    STITCH_RUNTIME_CSS_START,
    "/* Auto-generated by stitch-to-jsx.mjs for Stitch utility classes absent from the Tailwind baseline. */",
    "@layer utilities {",
    ...rules.map(rule => `  ${rule}`),
    "}",
    STITCH_RUNTIME_CSS_END,
  ].join("\n");
}

function collectStyleBlocks(html, out) {
  String(html || "").replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, css) => {
    const cleaned = sanitizeStitchCustomCss(css);
    if (cleaned) out.add(cleaned);
    return "";
  });
}

function sanitizeStitchCustomCss(css) {
  return String(css || "")
    .replace(/\.material-symbols(?:-[a-z0-9_-]+)?\s*\{[\s\S]*?\}\s*/gi, "")
    .replace(/font-family\s*:\s*['"]?(?:Material Symbols|Material Icons)[^;]*;?/gi, "")
    .replace(/font-family\s*:\s*(["']?)(?:Inter|Roboto|Arial|Helvetica|system-ui)\1(?:\s*,[^;{}]+)?;?/gi, "font-family: var(--font-body-md, \"Hanken Grotesk\"), \"Segoe UI\", sans-serif;")
    .replace(/theme\(\s*['"]colors\.([a-z0-9_.-]+)['"]\s*\)/gi, (_match, token) => {
      const cssVar = String(token || "").replace(/[_.]+/g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase();
      return cssVar ? `var(--color-${cssVar})` : "currentColor";
    })
    .replace(/\btransition\s*:\s*all\b/gi, "transition: color, background-color, border-color, box-shadow, opacity, transform")
    .trim();
}

function buildStitchCustomCss(styleBlocks) {
  const blocks = [...styleBlocks].map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return "";
  return [
    STITCH_CUSTOM_CSS_START,
    "/* Auto-generated by stitch-to-jsx.mjs from Stitch <style> blocks. */",
    ...blocks,
    STITCH_CUSTOM_CSS_END,
  ].join("\n");
}

function ensureStitchRuntimeCss(repoPath, classTokens, styleBlocks = new Set()) {
  const designTokens = designTokensForRepo(repoPath);
  const utilityBlock = buildRuntimeUtilityCss(classTokens, designTokens);
  const customBlock = buildStitchCustomCss(styleBlocks);
  const stitchTokensPath = path.join(repoPath, "stitch", "design-tokens.css");
  if (!utilityBlock && !customBlock && !fs.existsSync(stitchTokensPath)) return;

  const candidates = ["src/index.css", "src/main.css", "src/App.css", "app/globals.css"];
  let cssRel = candidates.find(rel => fs.existsSync(path.join(repoPath, rel)));
  if (!cssRel && fs.existsSync(path.join(repoPath, "src"))) cssRel = "src/index.css";
  if (!cssRel) return;

  const cssPath = path.join(repoPath, cssRel);
  if (!fs.existsSync(cssPath)) fs.writeFileSync(cssPath, "");
  let css = fs.readFileSync(cssPath, "utf-8");

  if (fs.existsSync(stitchTokensPath) && !css.includes("design-tokens.css")) {
    const relImport = path.relative(path.dirname(cssPath), stitchTokensPath).replace(/\\/g, "/");
    css = `@import '${relImport}';\n${css}`;
  }

  const utilityBlockPattern = new RegExp(`${escapeRegExp(STITCH_RUNTIME_CSS_START)}[\\s\\S]*?${escapeRegExp(STITCH_RUNTIME_CSS_END)}\\n?`, "m");
  const customBlockPattern = new RegExp(`${escapeRegExp(STITCH_CUSTOM_CSS_START)}[\\s\\S]*?${escapeRegExp(STITCH_CUSTOM_CSS_END)}\\n?`, "m");
  css = css.replace(utilityBlockPattern, "").replace(customBlockPattern, "").trimEnd();
  if (utilityBlock) css = `${css}\n\n${utilityBlock}\n`;
  if (customBlock) css = `${css}\n\n${customBlock}\n`;
  fs.writeFileSync(cssPath, css.endsWith("\n") ? css : `${css}\n`);
}

function materialIconSvgForName(iconName, unknownMaterialIcons, extraAttrs = "", classValue = "") {
  const mappedComponent = MATERIAL_TO_LUCIDE[iconName];
  const mappedBody = mappedComponent
    ? INTRINSIC_ICON_BODY_BY_LUCIDE[mappedComponent]
    : undefined;
  const fallback = !mappedBody;
  const observableIconName = iconName || "(empty)";
  if (fallback) {
    unknownMaterialIcons.set(
      observableIconName,
      (unknownMaterialIcons.get(observableIconName) || 0) + 1,
    );
  }
  const normalizedAttrs = String(extraAttrs || "").trim();
  const attrs = normalizedAttrs ? ` ${normalizedAttrs}` : "";
  const classAttr = classValue ? ` class="${escapeHtmlAttr(classValue)}"` : "";
  const source = fallback ? "neutral-fallback.v1" : "intrinsic-registry.v1";
  const body = mappedBody || INTRINSIC_ICON_FALLBACK_BODY;
  return `<svg${attrs}${classAttr} data-setfarm-icon="${escapeHtmlAttr(observableIconName)}" data-setfarm-icon-source="${source}" aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function cleanMaterialIconClass(classValue) {
  return normalizeClassTokens(classValue)
    .split(/\s+/)
    .filter(cls => cls && cls !== "material-icons" && !cls.startsWith("material-symbols"))
    .join(" ");
}

function replaceMaterialSymbolSpans(html, unknownMaterialIcons) {
  let out = String(html || "").replace(
    /<span\b([^>]*)\b(class|className)=(["'])([^"']*\b(?:material-symbols(?:-outlined)?|material-icons)\b[^"']*)\3([^>]*)>([\s\S]*?)<\/span>/gi,
    (_match, beforeClass, _classAttr, _quote, classValue, afterClass, inner) => {
      const iconName = materialIconKey(inner);
      const cleanedClass = cleanMaterialIconClass(classValue);
      const attrs = ["aria-hidden", "focusable", "data-icon", "title"]
        .reduce((next, attr) => stripJsxAttribute(next, attr), `${beforeClass || ""}${afterClass || ""}`)
        .trim();
      return materialIconSvgForName(iconName, unknownMaterialIcons, attrs, cleanedClass);
    },
  );
  out = out.replace(
    /<(button|a|i)\b([^>]*)\b(class|className)=(["'])([^"']*\b(?:material-symbols(?:-outlined)?|material-icons)\b[^"']*)\4([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag, beforeClass, _classAttr, _quote, classValue, afterClass, inner) => {
      const iconName = attrValue(`${beforeClass || ""}${afterClass || ""}`, "data-icon") || materialIconKey(inner);
      const cleanedClass = cleanMaterialIconClass(classValue);
      let attrs = ["data-icon"]
        .reduce((next, attr) => stripJsxAttribute(next, attr), `${beforeClass || ""}${afterClass || ""}`)
        .trim();
      if (cleanedClass) attrs += `${attrs ? " " : ""}class="${escapeHtmlAttr(cleanedClass)}"`;
      if ((tag.toLowerCase() === "button" || tag.toLowerCase() === "a") && !/\baria-label\s*=|\btitle\s*=/.test(attrs)) {
        attrs += `${attrs ? " " : ""}aria-label="${escapeHtmlAttr(humanizeActionLabel(iconName))}"`;
      }
      return `<${tag}${attrs ? ` ${attrs}` : ""}>${materialIconSvgForName(iconName, unknownMaterialIcons)}</${tag}>`;
    },
  );
  return out;
}

function writeUnknownMaterialIconsReport(repoPath, unknownMaterialIcons) {
  const setupDir = path.join(repoPath, ".setfarm", "setup");
  fs.mkdirSync(setupDir, { recursive: true });
  const icons = [...unknownMaterialIcons.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iconName, count]) => ({ iconName, count }));
  fs.writeFileSync(path.join(setupDir, "UNKNOWN_MATERIAL_ICONS.json"), JSON.stringify({
    status: icons.length > 0 ? "warning" : "pass",
    generatedAt: new Date().toISOString(),
    count: icons.length,
    icons,
    severity: icons.length > 0 ? "supervisor_fixable" : "none",
    guidance: icons.length > 0
      ? "Generated code used source-local neutral intrinsic SVG fallbacks for unmapped Material Symbols. Treat this as supervisor-fixable UI fidelity work, not a setup-build failure."
      : "All Material Symbols used by Stitch HTML were emitted from the bounded source-local intrinsic SVG registry.",
  }, null, 2));
}

function slugifyActionId(label, fallback) {
  const normalized = String(label || "")
    .replace(/[\u0131\u0130]/g, "i").replace(/[\u015f\u015e]/g, "s").replace(/[\u00e7\u00c7]/g, "c")
    .replace(/[\u011f\u011e]/g, "g").replace(/[\u00fc\u00dc]/g, "u").replace(/[\u00f6\u00d6]/g, "o")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return normalized || fallback;
}

function uniqueActionId(actions, base, index) {
  let id = `${base}-${index + 1}`;
  let n = 2;
  const used = new Set(actions.map((action) => action.id));
  while (used.has(id)) {
    id = `${base}-${index + 1}-${n++}`;
  }
  return id;
}

function attrValue(attrs, attrName) {
  const match = new RegExp(
    `(?:^|[\\t\\n\\f\\r ])${escapeRegExp(attrName)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    "i",
  ).exec(String(attrs || ""));
  return match ? String(match[1] ?? match[2] ?? match[3] ?? "").trim() : "";
}

function semanticActionRef(attrs) {
  const value = attrValue(attrs, "data-action");
  return /^ACT_[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(value) ? value : "";
}

function semanticActionInputs(attrs) {
  const value = attrValue(attrs, "data-action-input");
  if (!value) return [];
  const seen = new Set();
  return value
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const match = item.match(/^(ACT_[A-Z0-9]+(?:_[A-Z0-9]+)*)\.([A-Za-z][A-Za-z0-9_]*)$/);
      if (!match) return [];
      const key = `${match[1]}\0${match[2]}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ actionRef: match[1], inputField: match[2] }];
    });
}

function semanticElementRef(attrs) {
  const value = attrValue(attrs, "data-setfarm-element-ref");
  return /^E[0-9]{6}$/.test(value) ? value : "";
}

function semanticControlSlotRef(attrs) {
  const value = attrValue(attrs, "data-control-slot");
  return /^CSLOT_[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(value) ? value : "";
}

function escapeHtmlAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function annotateInteractiveElements(html, projection) {
  const actions = [];
  const valueControls = [];
  const rejectedControls = [];
  const actionInputFields = new Map();
  const actionInputInitialValues = new Map();
  const identities = [];
  let buttonIndex = 0;
  let linkIndex = 0;
  let inputIndex = 0;
  let textareaIndex = 0;
  let selectIndex = 0;
  const nativeV2Authority = projection?.authorityMode === "browser_rendered_v2";
  const browserAuthority = projection?.authorityMode === "browser_rendered_v1" || nativeV2Authority;
  const consumedActionElements = new Map();
  const consumedInputElements = new Map();
  const consumedControlSlots = new Map();
  const nextId = (label, fallback, index) => {
    const id = uniqueActionId(identities, slugifyActionId(label, fallback), index);
    identities.push({ id });
    return id;
  };
  const inputKey = (binding) => `${binding.actionRef}.${binding.inputField}`;
  const expectedInput = (binding) => projection?.expectedInputPairs.has(inputKey(binding)) ?? false;
  const exactElement = (mapping, semanticRef, elementRef) => Boolean(
    elementRef && mapping?.get(semanticRef)?.has(elementRef),
  );
  const exactActionElement = (actionRef, elementRef) => !browserAuthority
    || exactElement(projection.actionElementRefs, actionRef, elementRef);
  const exactInputElement = (binding, elementRef) => !browserAuthority
    || exactElement(projection.inputElementRefs, inputKey(binding), elementRef);
  const exactPhysicalControl = (actionRef, controlSlotRef, elementRef) => {
    if (!nativeV2Authority) return true;
    const control = projection.controlByElementRef?.get(elementRef);
    return Boolean(
      control
      && control.actionRef === actionRef
      && control.controlSlotRef === controlSlotRef
      && projection.controlElementRefs?.get(controlSlotRef)?.has(elementRef),
    );
  };
  const physicalControlFields = (actionRef, controlSlotRef, elementRef) => {
    if (!nativeV2Authority) return {};
    const control = projection.controlByElementRef?.get(elementRef);
    if (!control || control.actionRef !== actionRef || control.controlSlotRef !== controlSlotRef) return {};
    return {
      physicalControlRef: control.physicalControlRef,
      controlSlotRef: control.controlSlotRef,
      surfaceRef: control.surfaceRef,
      affectedSurfaceRefs: [...control.affectedSurfaceRefs],
      tagName: control.tagName,
      nativeControlKind: control.nativeControlKind,
      role: control.role,
      ariaLabel: control.ariaLabel,
      href: control.href,
      interactiveRole: control.interactiveRole,
    };
  };
  const registerActionInputs = (inputBindings, initialValue) => {
    for (const binding of inputBindings) {
      const fields = actionInputFields.get(binding.actionRef) || new Set();
      fields.add(binding.inputField);
      actionInputFields.set(binding.actionRef, fields);
      const key = inputKey(binding);
      if (!actionInputInitialValues.has(key)) actionInputInitialValues.set(key, "");
      if (initialValue !== undefined) actionInputInitialValues.set(key, String(initialValue));
    }
  };
  const consume = (map, semanticRef, elementRef) => {
    const key = `${semanticRef}\0${elementRef}`;
    map.set(key, (map.get(key) || 0) + 1);
  };
  const consumeAccepted = (actionRef, inputBindings, elementRef, controlSlotRef = "") => {
    if (actionRef) consume(consumedActionElements, actionRef, elementRef);
    for (const binding of inputBindings) consume(consumedInputElements, inputKey(binding), elementRef);
    if (controlSlotRef) consume(consumedControlSlots, controlSlotRef, elementRef);
    registerActionInputs(inputBindings);
  };
  const rejectControl = ({ id, kind, label, index, actionRef, inputBindings, href, sourceElementRef }) => {
    rejectedControls.push({
      rejectionId: id,
      kind,
      label,
      index,
      reasonCode: browserAuthority
        ? "outside_canonical_rendered_contract"
        : "undeclared_by_generation_target",
      ...(actionRef ? { rawActionRef: actionRef } : {}),
      ...(inputBindings.length > 0 ? { rawInputBindings: inputBindings } : {}),
      ...(href ? { href } : {}),
      ...(sourceElementRef ? { sourceElementRef } : {}),
    });
  };
  const neutralizedAttrs = (attrs, id, kind) => {
    let cleanAttrs = String(attrs || "");
    for (const attribute of [
      "data-action", "data-action-input", "data-action-id", "data-control-id",
      "data-setfarm-link-action", "onclick", "onClick", "onchange", "onChange",
      "oninput", "onInput", "onsubmit", "onSubmit", "tabindex", "tabIndex",
      "role", "hidden", "aria-hidden",
    ]) {
      cleanAttrs = stripJsxAttribute(cleanAttrs, attribute);
    }
    if (kind === "link") {
      for (const attribute of ["href", "target", "rel", "download"]) {
        cleanAttrs = stripJsxAttribute(cleanAttrs, attribute);
      }
    }
    if (["button", "input", "textarea", "select"].includes(kind)) {
      cleanAttrs = stripJsxAttribute(cleanAttrs, "disabled");
      cleanAttrs += " disabled";
    }
    return `${cleanAttrs} hidden="true" aria-hidden="true" data-setfarm-rejected-control="${id}"`;
  };
  const withButtons = mapPairedTagsRespectingQuotes(html, "button", ({ attrs, inner }) => {
    const index = buttonIndex++;
    const label = labelFromInteractive(attrs, inner, `Button ${index + 1}`);
    const id = nextId(label, "button", index);
    const actionRef = semanticActionRef(attrs);
    const inputBindings = semanticActionInputs(attrs);
    const sourceElementRef = semanticElementRef(attrs);
    const controlSlotRef = semanticControlSlotRef(attrs);
    const accepted = !projection || Boolean(
      actionRef
      && projection.expectedActionRefs.has(actionRef)
      && exactActionElement(actionRef, sourceElementRef)
      && inputBindings.every((binding) => expectedInput(binding) && exactInputElement(binding, sourceElementRef))
      && exactPhysicalControl(actionRef, controlSlotRef, sourceElementRef)
    );
    if (!accepted) {
      rejectControl({ id, kind: "button", label, index, actionRef, inputBindings, sourceElementRef });
      return `<button${neutralizedAttrs(attrs, id, "button")}>${inner}</button>`;
    }
    consumeAccepted(actionRef, inputBindings, sourceElementRef, controlSlotRef);
    actions.push({ id, kind: "button", label, index, ...(actionRef ? { actionRef } : {}), ...(inputBindings.length ? { inputBindings } : {}), ...(sourceElementRef ? { sourceElementRef } : {}), ...physicalControlFields(actionRef, controlSlotRef, sourceElementRef) });

    let cleanAttrs = String(attrs || "")
      .replace(/\sdata-action-id=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonclick=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonClick=\{[^}]*\}/g, "");
    if (!/\btype\s*=/.test(cleanAttrs)) cleanAttrs += ' type="button"';
    if (!/\baria-label\s*=/.test(cleanAttrs) && !/\btitle\s*=/.test(cleanAttrs) && !textFromHtml(stripMaterialIconSpans(inner))) {
      cleanAttrs += ` aria-label="${escapeHtmlAttr(label)}"`;
    }

    return `<button${cleanAttrs} data-action-id="${id}">${inner}</button>`;
  });
  const annotated = mapPairedTagsRespectingQuotes(withButtons, "a", ({ attrs, inner }) => {
    const index = linkIndex++;
    const href = attrValue(attrs, "href");
    const label = labelFromInteractive(attrs, inner, href || `Link ${index + 1}`);
    const id = nextId(label, "link", index);
    const actionRef = semanticActionRef(attrs);
    const inputBindings = semanticActionInputs(attrs);
    const sourceElementRef = semanticElementRef(attrs);
    const controlSlotRef = semanticControlSlotRef(attrs);
    const accepted = !projection || Boolean(
      actionRef
      && projection.expectedActionRefs.has(actionRef)
      && exactActionElement(actionRef, sourceElementRef)
      && inputBindings.every((binding) => expectedInput(binding) && exactInputElement(binding, sourceElementRef))
      && exactPhysicalControl(actionRef, controlSlotRef, sourceElementRef)
    );
    if (!accepted) {
      rejectControl({ id, kind: "link", label, index, actionRef, inputBindings, href, sourceElementRef });
      return `<a${neutralizedAttrs(attrs, id, "link")}>${inner}</a>`;
    }
    consumeAccepted(actionRef, inputBindings, sourceElementRef, controlSlotRef);
    actions.push({ id, kind: "link", label, href, index, ...(actionRef ? { actionRef } : {}), ...(inputBindings.length ? { inputBindings } : {}), ...(sourceElementRef ? { sourceElementRef } : {}), ...physicalControlFields(actionRef, controlSlotRef, sourceElementRef) });

    const cleanAttrs = String(attrs || "")
      .replace(/\sdata-action-id=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonclick=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonClick=\{[^}]*\}/g, "");
    const accessibleAttrs = !/\baria-label\s*=/.test(cleanAttrs) && !/\btitle\s*=/.test(cleanAttrs) && !textFromHtml(stripMaterialIconSpans(inner))
      ? `${cleanAttrs} aria-label="${escapeHtmlAttr(label)}"`
      : cleanAttrs;

    return `<a${accessibleAttrs} data-action-id="${id}">${inner}</a>`;
  });
  const splitSelfClosingAttrs = (attrs) => {
    const source = String(attrs || "");
    const marker = /\/\s*$/.exec(source);
    return {
      attrs: marker ? source.slice(0, marker.index).trimEnd() : source,
      selfClosing: Boolean(marker),
    };
  };
  const annotateValueTag = (tagName, attrs, fallback, index) => {
    const sourceAttrs = splitSelfClosingAttrs(attrs).attrs;
    const label = attrValue(sourceAttrs, "aria-label")
      || attrValue(sourceAttrs, "name")
      || attrValue(sourceAttrs, "placeholder")
      || attrValue(sourceAttrs, "id")
      || fallback;
    const actionRef = semanticActionRef(sourceAttrs);
    const inputBindings = semanticActionInputs(sourceAttrs);
    const sourceElementRef = semanticElementRef(sourceAttrs);
    const controlSlotRef = semanticControlSlotRef(sourceAttrs);
    const cleanAttrs = sourceAttrs
      .replace(/\sdata-action-id=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sdata-control-id=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonchange=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonChange=\{[^}]*\}/g, "");
    if (actionRef) {
      const id = nextId(label, tagName, actions.length);
      if (projection && (
        !projection.expectedActionRefs.has(actionRef)
        || !exactActionElement(actionRef, sourceElementRef)
        || !inputBindings.every((binding) => expectedInput(binding) && exactInputElement(binding, sourceElementRef))
        || !exactPhysicalControl(actionRef, controlSlotRef, sourceElementRef)
      )) {
        rejectControl({ id, kind: tagName, label, index, actionRef, inputBindings, sourceElementRef });
        return neutralizedAttrs(sourceAttrs, id, tagName);
      }
      consumeAccepted(actionRef, inputBindings, sourceElementRef, controlSlotRef);
      registerActionInputs(inputBindings, attrValue(sourceAttrs, "value"));
      actions.push({ id, kind: tagName, label, index, actionRef, ...(inputBindings.length ? { inputBindings } : {}), ...(sourceElementRef ? { sourceElementRef } : {}), ...physicalControlFields(actionRef, controlSlotRef, sourceElementRef) });
      return `${cleanAttrs} data-action-id="${id}"`;
    }
    if (inputBindings.length === 0 && !projection) return sourceAttrs;
    const id = nextId(label, tagName, valueControls.length);
    if (projection && (
      inputBindings.length === 0
      || !inputBindings.every((binding) => expectedInput(binding) && exactInputElement(binding, sourceElementRef))
    )) {
      rejectControl({ id, kind: tagName, label, index, actionRef, inputBindings, sourceElementRef });
      return neutralizedAttrs(sourceAttrs, id, tagName);
    }
    consumeAccepted(actionRef, inputBindings, sourceElementRef);
    registerActionInputs(inputBindings, attrValue(sourceAttrs, "value"));
    valueControls.push({ id, kind: tagName, label, index, inputBindings, ...(sourceElementRef ? { sourceElementRef } : {}) });
    return `${cleanAttrs} data-control-id="${id}"`;
  };
  const annotateValueTags = (source, targetTagName) => mapOpeningTagsRespectingQuotes(
    source,
    ({ tagName, attrs, original }) => {
      const normalizedTag = tagName.toLowerCase();
      if (normalizedTag !== targetTagName) return original;
      if (normalizedTag === "input") {
        const index = inputIndex++;
        return `<input${annotateValueTag("input", attrs, `Input ${index + 1}`, index)}>`;
      }
      if (normalizedTag === "textarea") {
        const index = textareaIndex++;
        const selfClosing = splitSelfClosingAttrs(attrs).selfClosing ? " /" : "";
        return `<textarea${annotateValueTag("textarea", attrs, `Textarea ${index + 1}`, index)}${selfClosing}>`;
      }
      const index = selectIndex++;
      const selfClosing = splitSelfClosingAttrs(attrs).selfClosing ? " /" : "";
      return `<select${annotateValueTag("select", attrs, `Select ${index + 1}`, index)}${selfClosing}>`;
    },
  );
  // Preserve the historical type-group annotation order. Generated local IDs
  // are consumed by exact DesignGraph bindings, so a quote-aware parser upgrade
  // must not renumber interleaved input/textarea/select controls on rerun.
  const withInputs = annotateValueTags(annotated, "input");
  const withTextareas = annotateValueTags(withInputs, "textarea");
  const withSelects = annotateValueTags(withTextareas, "select");
  const withRoleControls = nativeV2Authority
    ? mapOpeningTagsRespectingQuotes(withSelects, ({ original, tagName, attrs }) => {
        const sourceElementRef = semanticElementRef(attrs);
        const physical = projection.controlByElementRef?.get(sourceElementRef);
        if (!physical || physical.nativeControlKind !== null) return original;
        const actionRef = semanticActionRef(attrs);
        const controlSlotRef = semanticControlSlotRef(attrs);
        const inputBindings = semanticActionInputs(attrs);
        if (
          actionRef !== physical.actionRef
          || controlSlotRef !== physical.controlSlotRef
          || !exactPhysicalControl(actionRef, controlSlotRef, sourceElementRef)
          || !inputBindings.every((binding) => expectedInput(binding) && exactInputElement(binding, sourceElementRef))
        ) {
          failConversion("V2_ROLE_CONTROL_PROJECTION_MISMATCH", `role control ${physical.controlSlotRef} lost its same-element semantic identity`);
        }
        const label = attrValue(attrs, "aria-label") || attrValue(attrs, "title") || physical.controlSlotRef;
        const id = nextId(label, "control", actions.length);
        const selfClosing = /\/\s*$/.test(attrs);
        const attributeBody = selfClosing ? attrs.replace(/\/\s*$/, "") : attrs;
        let cleanAttrs = stripJsxAttribute(String(attributeBody || ""), "data-action-id");
        cleanAttrs = stripJsxAttribute(cleanAttrs, "onclick");
        cleanAttrs = stripJsxAttribute(cleanAttrs, "onClick");
        consumeAccepted(actionRef, inputBindings, sourceElementRef, controlSlotRef);
        actions.push({
          id,
          kind: physical.role === "link" ? "link" : "button",
          label,
          index: actions.length,
          actionRef,
          ...(inputBindings.length ? { inputBindings } : {}),
          sourceElementRef,
          ...physicalControlFields(actionRef, controlSlotRef, sourceElementRef),
        });
        return `<${tagName}${cleanAttrs} data-action-id="${id}"${selfClosing ? " />" : ">"}`;
      })
    : withSelects;
  if (browserAuthority) {
    if (nativeV2Authority) {
      for (const [controlSlotRef, refs] of projection.controlElementRefs) {
        const elementRef = [...refs][0];
        if (consumedControlSlots.get(`${controlSlotRef}\0${elementRef}`) !== 1) {
          failConversion("V2_RENDERED_CONTROL_PROJECTION_MISMATCH", `control slot ${controlSlotRef} was not projected exactly once from browser element ${elementRef}`);
        }
      }
    } else {
      for (const [actionRef, refs] of projection.actionElementRefs) {
        const elementRef = [...refs][0];
        if (consumedActionElements.get(`${actionRef}\0${elementRef}`) !== 1) {
          failConversion("V3_RENDERED_ACTION_PROJECTION_MISMATCH", `action ${actionRef} was not projected exactly once from browser element ${elementRef}`);
        }
      }
    }
    for (const [inputRef, refs] of projection.inputElementRefs) {
      const elementRef = [...refs][0];
      if (consumedInputElements.get(`${inputRef}\0${elementRef}`) !== 1) {
        failConversion("V3_RENDERED_INPUT_PROJECTION_MISMATCH", `action input ${inputRef} was not projected exactly once from browser element ${elementRef}`);
      }
    }
  }
  return {
    html: withRoleControls,
    actions,
    valueControls,
    rejectedControls,
    actionInputFields,
    actionInputInitialValues,
  };
}

function annotateObservableElements(html, projection) {
  const required = projection?.requiredObservables || projection?.requiredAccessibilityObservables || [];
  if (required.length === 0) return { html: String(html || ""), observables: [] };

  const browserAuthority = projection?.authorityMode === "browser_rendered_v1" || projection?.authorityMode === "browser_rendered_v2";
  if (browserAuthority) {
    const byElementRef = new Map();
    for (const observable of required) {
      const elementRef = [...observable.elementRefs][0];
      const entries = byElementRef.get(elementRef) || [];
      entries.push(observable);
      byElementRef.set(elementRef, entries);
    }
    const counts = new Map(required.map((observable) => [observable.observableRef, 0]));
    const annotated = mapOpeningTagsRespectingQuotes(html, ({ original, tagName, attrs }) => {
      const elementRef = semanticElementRef(attrs);
      const matches = byElementRef.get(elementRef);
      if (!matches) return original;
      for (const observable of matches) {
        if (
          observable.selectorKind === "control"
          && semanticControlSlotRef(attrs) !== observable.controlSlotRef
        ) {
          failConversion("V2_OBSERVABLE_RENDERED_ELEMENT_MISMATCH", `observable ${observable.observableRef} lost its exact control-slot source`);
        }
        if (
          observable.selectorKind === "surface"
          && attrValue(attrs, "data-surface-id") !== observable.surfaceRef
        ) {
          failConversion("V2_OBSERVABLE_RENDERED_ELEMENT_MISMATCH", `observable ${observable.observableRef} lost its exact surface source`);
        }
        counts.set(observable.observableRef, (counts.get(observable.observableRef) || 0) + 1);
      }
      const refs = matches.map((entry) => entry.observableRef).sort().join(" ");
      const selfClosing = /\/\s*$/.test(attrs);
      const attributeBody = selfClosing ? attrs.replace(/\/\s*$/, "") : attrs;
      const accessibility = matches.filter((entry) => entry.selectorKind === "accessibility");
      const roleValues = new Set(accessibility.map((entry) => entry.role));
      const nameValues = new Set(accessibility.map((entry) => entry.name));
      if (roleValues.size > 1 || nameValues.size > 1) {
        failConversion(
          "V3_OBSERVABLE_RENDERED_ELEMENT_MISMATCH",
          `browser element ${elementRef} cannot carry conflicting accessibility receipts`,
        );
      }
      let cleanAttrs = stripJsxAttribute(String(attributeBody || ""), "data-observable-refs");
      let accessibilityAttrs = "";
      if (accessibility.length > 0) {
        const role = accessibility[0]?.role;
        const name = accessibility[0]?.name;
        if (!role || !name) {
          failConversion(
            "V3_OBSERVABLE_RENDERED_ELEMENT_MISMATCH",
            `browser element ${elementRef} has an incomplete accessibility receipt`,
          );
        }
        cleanAttrs = stripJsxAttribute(stripJsxAttribute(cleanAttrs, "role"), "aria-label");
        accessibilityAttrs = ` role="${escapeHtmlAttr(role)}" aria-label="${escapeHtmlAttr(name)}"`;
      }
      return `<${tagName}${cleanAttrs}${accessibilityAttrs} data-observable-refs="${escapeHtmlAttr(refs)}"${selfClosing ? " />" : ">"}`;
    });
    for (const observable of required) {
      if (counts.get(observable.observableRef) !== 1) {
        failConversion("V3_OBSERVABLE_RENDERED_ELEMENT_MISMATCH", `observable ${observable.observableRef} was not projected exactly once from browser evidence`);
      }
    }
    return {
      html: annotated,
      observables: required.map((observable) => ({
        observableRef: observable.observableRef,
        ...(observable.role ? { role: observable.role } : {}),
        ...(observable.name ? { name: observable.name } : {}),
        ...(observable.actionRef ? { actionRef: observable.actionRef } : {}),
        ...(observable.selectorKind ? { selectorKind: observable.selectorKind } : {}),
        ...(observable.controlSlotRef ? { controlSlotRef: observable.controlSlotRef } : {}),
        ...(observable.surfaceRef ? { surfaceRef: observable.surfaceRef } : {}),
        ...(observable.evidenceRef ? { evidenceRef: observable.evidenceRef } : {}),
        sourceElementRef: [...observable.elementRefs][0],
      })),
    };
  }

  const bySelector = new Map();
  for (const observable of required) {
    if (!/^OBS_[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(observable.observableRef)) {
      failConversion("V3_OBSERVABLE_REF_INVALID", "observable reference is missing or duplicated");
    }
    if (!observable.role || !observable.name) {
      failConversion("V3_OBSERVABLE_SELECTOR_INVALID", "observable selector is invalid");
    }
    const key = `${observable.role}\0${observable.name}`;
    const entries = bySelector.get(key) || [];
    entries.push(observable);
    bySelector.set(key, entries);
  }

  const counts = new Map([...bySelector.keys()].map((key) => [key, 0]));
  const annotated = mapOpeningTagsRespectingQuotes(
    html,
    ({ original, tagName, attrs }) => {
      const role = attrValue(attrs, "role");
      const name = attrValue(attrs, "aria-label");
      const key = `${role}\0${name}`;
      const matches = bySelector.get(key);
      if (!matches) return original;
      counts.set(key, (counts.get(key) || 0) + 1);
      const refs = matches.map((entry) => entry.observableRef).sort().join(" ");
      const selfClosing = /\/\s*$/.test(attrs);
      const attributeBody = selfClosing ? attrs.replace(/\/\s*$/, "") : attrs;
      const cleanAttrs = stripJsxAttribute(String(attributeBody || ""), "data-observable-refs");
      return `<${tagName}${cleanAttrs} data-observable-refs="${escapeHtmlAttr(refs)}"${selfClosing ? " />" : ">"}`;
    },
  );

  for (const [key, matches] of bySelector) {
    const count = counts.get(key) || 0;
    if (count !== 1) {
      const code = count === 0 ? "V3_OBSERVABLE_SELECTOR_MISSING" : "V3_OBSERVABLE_SELECTOR_AMBIGUOUS";
      failConversion(code, "observable selector cardinality does not match its contract");
    }
  }
  return {
    html: annotated,
    observables: required.map((observable) => ({ ...observable })),
  };
}

function sortedActionInputFields(actionRef, actionInputFields) {
  return [...(actionInputFields.get(actionRef) || [])].sort();
}

function actionPayloadExpression(action, actionInputFields, currentValueKeys = new Set()) {
  if (!action.actionRef) return "";
  const fields = sortedActionInputFields(action.actionRef, actionInputFields);
  if (fields.length === 0) return "";
  const properties = fields.map((field) => {
    const key = `${action.actionRef}.${field}`;
    const value = currentValueKeys.has(key)
      ? "nextValue"
      : `actionInputValues[${JSON.stringify(key)}]`;
    return `${JSON.stringify(field)}: ${value}`;
  });
  return `{ ${properties.join(", ")} }`;
}

function actionDispatchExpression(action, actionInputFields, currentValueKeys = new Set()) {
  const payload = actionPayloadExpression(action, actionInputFields, currentValueKeys);
  return `actions?.[${JSON.stringify(action.id)}]?.(${payload})`;
}

function inputStateUpdateStatements(inputBindings) {
  const keys = [...new Set(inputBindings.map((binding) =>
    `${binding.actionRef}.${binding.inputField}`))].sort();
  if (keys.length === 0) return { keys, statements: "" };
  const updates = keys.map((key) => `${JSON.stringify(key)}: nextValue`).join(", ");
  return {
    keys,
    statements: `const nextValue = event.currentTarget.value; setActionInputValues((current) => ({ ...current, ${updates} })); `,
  };
}

function materializeInteractiveRuntime(jsx, actions, valueControls, actionInputFields) {
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const valueControlById = new Map(valueControls.map((control) => [control.id, control]));
  return mapOpeningTagsRespectingQuotes(jsx, ({ original, tagName, attrs }) => {
    const actionId = attrValue(attrs, "data-action-id");
    const controlId = attrValue(attrs, "data-control-id");
    const action = actionId ? actionById.get(actionId) : undefined;
    const valueControl = controlId ? valueControlById.get(controlId) : undefined;
    if (!action && !valueControl) return original;

    const selfClosing = /\/\s*$/.test(attrs);
    let cleanAttrs = selfClosing ? attrs.replace(/\/\s*$/, "") : attrs;
    cleanAttrs = stripJsxAttribute(cleanAttrs, "onClick");
    cleanAttrs = stripJsxAttribute(cleanAttrs, "onChange");

    const normalizedTag = tagName.toLowerCase();
    const valueLike = ["input", "textarea", "select"].includes(normalizedTag);
    if (action) {
      const payload = actionPayloadExpression(action, actionInputFields);
      if (valueLike) {
        const update = inputStateUpdateStatements(action.inputBindings || []);
        if (update.keys.length > 0 && !(normalizedTag === "input" && attrValue(cleanAttrs, "type").toLowerCase() === "file")) {
          cleanAttrs = stripJsxAttribute(cleanAttrs, "value");
          cleanAttrs = stripJsxAttribute(cleanAttrs, "defaultValue");
          cleanAttrs += ` value={actionInputValues[${JSON.stringify(update.keys[0])}]}`;
        }
        const dispatch = actionDispatchExpression(action, actionInputFields, new Set(update.keys));
        if (update.statements) {
          cleanAttrs += ` onChange={(event) => { ${update.statements}${dispatch}; }}`;
        } else if (payload) {
          cleanAttrs += ` onChange={() => { ${dispatch}; }}`;
        } else {
          cleanAttrs += ` onChange={actions?.[${JSON.stringify(action.id)}]}`;
        }
      } else {
        const dispatch = actionDispatchExpression(action, actionInputFields);
        if (normalizedTag === "a") {
          cleanAttrs += ` onClick={(event) => { event.preventDefault(); ${dispatch}; }}`;
        } else if (payload) {
          cleanAttrs += ` onClick={() => { ${dispatch}; }}`;
        } else {
          cleanAttrs += ` onClick={actions?.[${JSON.stringify(action.id)}]}`;
        }
      }
    } else if (valueControl) {
      const update = inputStateUpdateStatements(valueControl.inputBindings || []);
      if (update.keys.length === 0) {
        failConversion("STITCH_ACTION_INPUT_RUNTIME_INVALID", `value control ${valueControl.id} has no exact action-input binding`);
      }
      if (!(normalizedTag === "input" && attrValue(cleanAttrs, "type").toLowerCase() === "file")) {
        cleanAttrs = stripJsxAttribute(cleanAttrs, "value");
        cleanAttrs = stripJsxAttribute(cleanAttrs, "defaultValue");
        cleanAttrs += ` value={actionInputValues[${JSON.stringify(update.keys[0])}]}`;
      }
      cleanAttrs += ` onChange={(event) => { ${update.statements}}}`;
    }
    return `<${tagName}${cleanAttrs}${selfClosing ? " />" : ">"}`;
  });
}

function actionCallbackProperties(actions, actionInputFields) {
  return actions.map((action) => {
    const fields = action.actionRef
      ? sortedActionInputFields(action.actionRef, actionInputFields)
      : [];
    if (fields.length === 0) return `    ${JSON.stringify(action.id)}?: () => void;`;
    const payload = fields.map((field) => `${JSON.stringify(field)}: string`).join("; ");
    return `    ${JSON.stringify(action.id)}?: (payload: { ${payload} }) => void;`;
  }).join("\n");
}

function actionInputStateDeclaration(actionInputFields, actionInputInitialValues) {
  const keys = [...actionInputFields]
    .flatMap(([actionRef, fields]) => [...fields].map((field) => `${actionRef}.${field}`))
    .sort();
  if (keys.length === 0) return "";
  const stateType = keys.map((key) => `    ${JSON.stringify(key)}: string;`).join("\n");
  const initialState = keys.map((key) =>
    `    ${JSON.stringify(key)}: ${JSON.stringify(actionInputInitialValues.get(key) || "")},`).join("\n");
  return `  const [actionInputValues, setActionInputValues] = useState<{\n${stateType}\n  }>({\n${initialState}\n  });\n`;
}

function compareUtf16Strings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function generatedScreenComponentApi(actions, valueControls, actionInputFields) {
  const actionBindings = actions
    .filter((action) => Boolean(action.actionRef))
    .map((action) => ({
      generatedLocalId: action.id,
      actionRef: action.actionRef,
      inputFields: sortedActionInputFields(action.actionRef, actionInputFields),
    }))
    .sort((left, right) => compareUtf16Strings(
      `${left.generatedLocalId}\0${left.actionRef}`,
      `${right.generatedLocalId}\0${right.actionRef}`,
    ));
  const inputTransports = [...actions, ...valueControls]
    .flatMap((control) => (control.inputBindings || []).map((binding) => {
      const actionInputRef = `${binding.actionRef}.${binding.inputField}`;
      return {
        actionInputRef,
        generatedControlId: control.id,
        stateKey: actionInputRef,
      };
    }))
    .sort((left, right) => compareUtf16Strings(
      `${left.actionInputRef}\0${left.generatedControlId}`,
      `${right.actionInputRef}\0${right.generatedControlId}`,
    ));
  return {
    schema: "setfarm.generated-screen-component-api.v1",
    actionsPropName: "actions",
    actionBindings,
    inputTransports,
  };
}

function stripNonRenderedHtmlBlocks(html) {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<template\b[\s\S]*?<\/template>/gi, "");
}

function isGameplayScreen(screen) {
  return /\b(gameplay|playfield|browser[- ]?game|arcade|SURF_GAMEPLAY)\b/i.test(
    [screen?.title, screen?.screenId, screen?.surfaceId, screen?.kind].filter(Boolean).join(" "),
  );
}

function gameRuntimeType() {
  return "{ player?: { lane?: number; position?: number }; obstacles?: Array<{ lane?: number; position?: number }>; shards?: Array<{ lane?: number; position?: number }>; score?: number; energy?: number; lives?: number; paused?: boolean }";
}

const screenIndex = [];
const usedClassTokens = new Set();
const stitchStyleBlocks = new Set();
const unknownMaterialIcons = new Map();
for (const screen of manifest) {
  if (isPrdPseudoScreen(screen)) { console.warn("  SKIP PRD:", screen.title); continue; }
  const projection = v3ProjectionContract?.byScreenId.get(String(screen.screenId || ""));
  if (v3ProjectionContract && !projection) {
    failConversion("V3_PROJECTION_SCREEN_UNBOUND", "Stitch screen has no exact projection binding");
  }
  const htmlFile = projection?.authorityMode === "browser_rendered_v1" || projection?.authorityMode === "browser_rendered_v2"
    ? projection.semanticDomFile
    : findScreenHtml(screen);
  if (!htmlFile) { console.warn("  SKIP invalid/missing HTML:", screen.title); continue; }
  const raw = fs.readFileSync(htmlFile, "utf-8");
  collectStyleBlocks(raw, stitchStyleBlocks);
  const body = extractBody(raw);
  const renderableBody = stripNonRenderedHtmlBlocks(body);
  const classNormalizedBody = normalizeDesignClassAttributes(renderableBody);
  const observableProjection = annotateObservableElements(classNormalizedBody, projection);
  const {
    html: interactiveBody,
    actions,
    valueControls,
    rejectedControls,
    actionInputFields,
    actionInputInitialValues,
  } = annotateInteractiveElements(observableProjection.html, projection);
  const sourceLocator = projection?.authorityMode === "browser_rendered_v1" || projection?.authorityMode === "browser_rendered_v2"
    ? projection.semanticDomLocator
    : path.relative(repoPath, htmlFile).split(path.sep).join("/");
  const indexedActions = actions.map((action) => action.actionRef ? {
    ...action,
    generatedLocalId: action.id,
    semanticSource: "data-action",
    sourceLocator,
    selector: `[data-action-id="${action.id}"]`,
  } : action);
  const indexedValueControls = valueControls.map((control) => ({
    ...control,
    generatedLocalId: control.id,
    semanticSource: "data-action-input",
    sourceLocator,
    selector: `[data-control-id="${control.id}"]`,
  }));
  const indexedObservables = observableProjection.observables.map((observable) => ({
    observableRef: observable.observableRef,
    ...(observable.role ? { role: observable.role } : {}),
    ...(observable.name ? { name: observable.name } : {}),
    ...(observable.actionRef ? { actionRef: observable.actionRef } : {}),
    ...(observable.selectorKind ? { selectorKind: observable.selectorKind } : {}),
    ...(observable.controlSlotRef ? { controlSlotRef: observable.controlSlotRef } : {}),
    ...(observable.surfaceRef ? { surfaceRef: observable.surfaceRef } : {}),
    ...(observable.evidenceRef ? { evidenceRef: observable.evidenceRef } : {}),
    ...(observable.sourceElementRef ? { sourceElementRef: observable.sourceElementRef } : {}),
    sourceLocator,
    selector: `[data-observable-refs~="${observable.observableRef}"]`,
  }));
  const normalizedBody = replaceMaterialSymbolSpans(interactiveBody, unknownMaterialIcons);
  collectClassTokens(normalizedBody, usedClassTokens);
  const jsx = materializeInteractiveRuntime(
    htmlToJsx(normalizedBody),
    actions,
    valueControls,
    actionInputFields,
  );
  const name = toComponentName(screen.title);
  if (!name) { console.warn("  SKIP empty component name:", screen.title); continue; }
  const nativeButtons = [...renderableBody.matchAll(/<button[^>]*>/gi)].length;
  const inputs = [...renderableBody.matchAll(/<input[^>]*>/gi)].length;
  const textareas = [...renderableBody.matchAll(/<textarea[^>]*>/gi)].length;
  const selects = [...renderableBody.matchAll(/<select[^>]*>/gi)].length;
  const nativeLinks = [...renderableBody.matchAll(/<a\s[^>]*>/gi)].length;
  const customRoleActions = actions.filter((action) =>
    action.nativeControlKind === null && action.interactiveRole === true);
  const buttons = nativeButtons + customRoleActions.filter((action) => action.kind !== "link").length;
  const links = nativeLinks + customRoleActions.filter((action) => action.kind === "link").length;
  const actionType = actions.length > 0 ? actions.map((action) => JSON.stringify(action.id)).join(" | ") : "never";
  const needsRuntime = isGameplayScreen(screen);
  const functionSignature = actions.length > 0 || needsRuntime
    ? `export function ${name}({ ${[
      actions.length > 0 ? "actions" : "",
      needsRuntime ? "runtime" : "",
    ].filter(Boolean).join(", ")} }: ${name}Props) {`
    : `export function ${name}(_props: ${name}Props) {`;
  const imports = [];
  if (actionInputFields.size > 0) imports.push('import { useState } from "react";');
  const importBlock = imports.length > 0 ? `${imports.join("\n")}\n\n` : "";
  const runtimeProp = needsRuntime ? `  runtime?: ${gameRuntimeType()};\n` : "";
  const callbackProperties = actionCallbackProperties(actions, actionInputFields);
  const actionInputState = actionInputStateDeclaration(actionInputFields, actionInputInitialValues);
  const componentApi = generatedScreenComponentApi(actions, valueControls, actionInputFields);

  const code = `// AUTO-GENERATED from Stitch — DO NOT modify layout or CSS
// Screen: ${screen.title}
// 
// AGENT INSTRUCTIONS:
// 1. DO NOT change className values or layout structure
// 2. Preserve the generated action-input state and exact payload transport
// 3. Wire interactive controls through the typed actions prop
// 4. Replace placeholder data with props/state

${importBlock}
export type ${name}ActionId = ${actionType};

export interface ${name}Props {
  actions?: {
${callbackProperties}
  };
${runtimeProp}
}

export type ${name}ActionCallbacks = NonNullable<${name}Props["actions"]>;

${functionSignature}
${needsRuntime ? "  void runtime;\n" : ""}${actionInputState}  return (
    <>
${jsx.split("\n").map(l => "      " + l).join("\n")}
    </>
  );
}
`;
  const generatedSourceLocator = "src/screens/" + name + ".tsx";
  fs.writeFileSync(path.join(screensDir, name + ".tsx"), code);
  const indexedRejectedControls = rejectedControls.map((control) => ({
    ...control,
    sourceLocator,
    generatedSourceLocator,
    selector: `[data-setfarm-rejected-control="${control.rejectionId}"]`,
  }));
  screenIndex.push({
    screenId: screen.screenId,
    title: screen.title,
    componentName: name,
    file: generatedSourceLocator,
    buttons,
    inputs,
    textareas,
    selects,
    links,
    actions: indexedActions,
    controls: [...indexedActions, ...indexedValueControls].map((control) => ({
      ...control,
      generatedSourceLocator,
    })),
    observables: indexedObservables.map((observable) => ({
      ...observable,
      generatedSourceLocator,
    })),
    ...(projection ? {
      projection: {
        schema: "setfarm.stitch-screen-projection.v2",
        mode: "contract_only",
        targetRef: projection.targetRef,
        ...(projection.authorityMode === "browser_rendered_v2"
          ? { authoritySchema: "setfarm.design-interaction-graph.v2" }
          : {}),
        rawInteractiveCounts: { buttons, links, inputs, textareas, selects },
        requiredObservableRefs: indexedObservables.map((observable) => observable.observableRef).sort(),
      },
    } : {}),
    componentApi,
    ...(projection ? { rejectedControls: indexedRejectedControls } : {}),
  });
  console.log(
    "  OK:",
    screen.title,
    "->",
    name + ".tsx",
    "(" + buttons + "btn," + inputs + "inp," + links + "lnk," + indexedRejectedControls.length + " rejected)",
  );
}

fs.writeFileSync(path.join(screensDir, "SCREEN_INDEX.json"), JSON.stringify(screenIndex, null, 2));
const uniqueBarrelScreens = [];
const seenBarrelComponents = new Set();
for (const screen of screenIndex) {
  if (!screen?.componentName || seenBarrelComponents.has(screen.componentName)) continue;
  seenBarrelComponents.add(screen.componentName);
  uniqueBarrelScreens.push(screen);
}
const barrel = uniqueBarrelScreens
  .map((screen) => [
    `export { ${screen.componentName} } from "./${screen.componentName}";`,
    `export type { ${screen.componentName}Props, ${screen.componentName}ActionId, ${screen.componentName}ActionCallbacks } from "./${screen.componentName}";`,
  ].join("\n"))
  .join("\n");
fs.writeFileSync(path.join(screensDir, "index.ts"), barrel ? `${barrel}\n` : "");
ensureStitchRuntimeCss(repoPath, usedClassTokens, stitchStyleBlocks);
writeUnknownMaterialIconsReport(repoPath, unknownMaterialIcons);
if (unknownMaterialIcons.size > 0) {
  console.warn("UNKNOWN_MATERIAL_ICONS: stitch-to-jsx used source-local neutral intrinsic SVG fallbacks.");
  for (const [iconName, count] of [...unknownMaterialIcons.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.warn(`  - ${iconName} (${count})`);
  }
  console.warn("Supervisor should repair icon fidelity if the generated fallback harms the UI.");
}
console.log("Generated", screenIndex.length, "screen(s)");
writeConversionResult({ status: "passed" });
