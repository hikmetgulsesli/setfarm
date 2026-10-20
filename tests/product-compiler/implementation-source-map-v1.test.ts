import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceDesignInteractionGraphV2 } from "../../src/product-compiler/producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { produceImplementationSourceMapV1 } from "../../src/product-compiler/producers/implementation-source-map-v1.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { captureStitchRenderedSemanticsV2 } from "../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import { produceStoryPlanV2 } from "../../src/product-compiler/producers/story-plan-v2.js";
import { BuildTopologyV1Schema } from "../../src/product-compiler/schemas/build-topology-v1.js";
import {
  ImplementationSourceMapV1Schema,
  implementationSourceMapPayloadHashV1,
} from "../../src/product-compiler/schemas/implementation-source-map-v1.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  StitchScreenIndexV2Schema,
  type StitchScreenIndexEntryV2,
} from "../../src/product-compiler/schemas/stitch-screen-index-v2.js";
import { buildContainedGameProductSpecV2, containedGamePlanProposalV2, CONTAINED_GAME_TASK } from "./fixtures/product-semantics-v2.js";
import { buildNoDesignProductBuildPacketV3Contracts } from "./fixtures/product-build-packet-v3.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

const GENERATED_PATH = "src/screens/PlayPage.tsx";
const GENERATED_HASH = "d".repeat(64);

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function typedArtifactRef(artifactType: string, payloadHash: string, salt: string) {
  return {
    artifactType,
    envelopeHash: sha256(`envelope:${salt}`),
    payloadHash,
  };
}

function noDesignClosure() {
  return {
    schema: "setfarm.design-source-closure.v2",
    kind: "none" as const,
    reason: "product_delivery_design_not_required" as const,
  };
}

function stitchClosure(input: {
  generationTargets: unknown;
  responseBindings: unknown;
  designGraph: unknown;
}) {
  return {
    schema: "setfarm.design-source-closure.v2",
    kind: "stitch" as const,
    generationTargets: typedArtifactRef(
      "setfarm.design-generation-targets.v2",
      hashCanonicalJson(input.generationTargets),
      "targets",
    ),
    directResponseEvidence: typedArtifactRef(
      "setfarm.stitch-direct-response-evidence.v2",
      sha256("direct-response-payload"),
      "direct-response",
    ),
    renderedSemantics: typedArtifactRef(
      "setfarm.stitch-rendered-semantics.v2",
      sha256("rendered-semantics-payload"),
      "rendered-semantics",
    ),
    candidateSelection: typedArtifactRef(
      "setfarm.stitch-target-candidate-selection.v2",
      sha256("candidate-selection-payload"),
      "candidate-selection",
    ),
    responseBindings: typedArtifactRef(
      "setfarm.stitch-target-response-bindings.v3",
      hashCanonicalJson(input.responseBindings),
      "response-bindings",
    ),
    designGraph: typedArtifactRef(
      "setfarm.design-interaction-graph.v2",
      hashCanonicalJson(input.designGraph),
      "design-graph",
    ),
    acceptedAttempt: {
      attemptRef: `PCA_${sha256("accepted-attempt")}`,
      outputSealHash: sha256("output-seal"),
    },
    artifactManifest: {
      artifactType: "setfarm.product-compilation-artifact-manifest.v1",
      artifactHash: sha256("artifact-manifest"),
    },
    projectionReceipt: {
      artifactType: "setfarm.product-compilation-projection-receipt.v1",
      artifactHash: sha256("projection-receipt"),
    },
  };
}

function topologyFor(
  productSpec: ReturnType<typeof buildContainedGameProductSpecV2>,
  generatedHash = GENERATED_HASH,
) {
  return BuildTopologyV1Schema.parse({
    schema: "setfarm.build-topology.v1",
    stackPack: {
      id: "vite-react",
      version: "1.0.0",
      contentHash: "a".repeat(64),
    },
    repo: {
      id: "implementation-source-map-v1-test",
      baseSha: "b".repeat(40),
      treeHash: "c".repeat(40),
    },
    owners: [{ id: "OWNER_US_001", kind: "story", storyRef: "US-001" }],
    pathBindings: [{
      id: "PATH_PLAY_PAGE",
      path: GENERATED_PATH,
      role: "generated",
      ownerRef: "OWNER_US_001",
      presence: "present",
      knownContentHash: generatedHash,
    }],
    sharedGrants: [],
    entrypoints: [{
      id: "ENTRY_WEB",
      kind: "web",
      pathRef: "PATH_PLAY_PAGE",
      mountPoint: "/",
      routeRefs: productSpec.routes.map((route) => route.id).sort(),
    }],
    commands: [{
      id: "CMD_BUILD",
      kind: "build",
      argv: ["npm", "run", "build"],
      cwd: ".",
      timeoutMs: 120_000,
      capabilityRefs: [],
    }],
    capabilities: [
      { id: "CAP_BROWSER_INTERACTION", kind: "browser_interaction", enabled: true },
      { id: "CAP_LOCAL_PERSISTENCE", kind: "local_persistence", enabled: true },
    ],
    policies: {
      packageManager: "npm",
      allowedRoots: ["src"],
      deniedGlobs: [],
      buildOutputPaths: ["dist"],
    },
  });
}

async function exactStitchInput(options: { readonlyTextbox?: boolean; sharedReadonlyObservable?: boolean } = {}) {
  let productSpec = buildContainedGameProductSpecV2();
  if (options.readonlyTextbox) {
    // Establish real required selectors/evidence before capture. Shared refs
    // receive separate authentic browser receipts for the same native element.
    const proposal = containedGamePlanProposalV2();
    const action = proposal.actions[0];
    const observable = action.observables.find((entry: any) => entry.selector.kind === "accessibility");
    observable.selector.role = "textbox";
    observable.assertions = [{ phase: "after", property: "value", operator: "equals", expected: "Playing" }];
    if (options.sharedReadonlyObservable) action.observables.push({ ...structuredClone(observable), key: "status_value_shared" });
    const compiled = compilePlanSemanticProposalV2({ task: CONTAINED_GAME_TASK, proposal });
    assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
    if (compiled.status !== "canonicalized") throw new Error("unreachable");
    productSpec = ProductSpecV2Schema.parse(compiled.productSpec);
  }
  const targetsResult = produceDesignGenerationTargetsV2(productSpec);
  assert.equal(targetsResult.status, "produced", JSON.stringify(targetsResult));
  if (targetsResult.status !== "produced") throw new Error("unreachable");
  const generationTargets = targetsResult.generationTargets;
  const target = generationTargets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const statusObservable = target.requiredObservableSelectors.find((observable) =>
    observable.selector.kind === "accessibility")!;
  assert.equal(statusObservable.selector.kind, "accessibility");
  if (statusObservable.selector.kind !== "accessibility") throw new Error("unreachable");
  const statusSurface = statusObservable.selector.surfaceRef;
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
    surfaceRef !== statusSurface)!;
  const htmlBytes = validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}">`,
    `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
    `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
    options.readonlyTextbox
      ? `<section data-surface-id="${statusSurface}"><input type="text" readonly aria-label="Game status" value="Playing" /><input hidden aria-label="Undeclared adjacent input" /></section>`
      : `<section data-surface-id="${statusSurface}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
    "</main>",
  ].join(""), "implementation-source-map-v1");
  const screenshotBytes = validStitchPng(241);
  const screenId = "screen-implementation-source-map-v1";
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "implementation-source-map-v1-test",
    batches: [{
      stageId: "stage-implementation-source-map-v1",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: [{
        screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens.screen-implementation-source-map-v1"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(screenId, htmlBytes, screenshotBytes),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }],
    }],
  };
  const artifacts = [{ screenId, htmlBytes, screenshotBytes }];
  const rendered = await captureStitchRenderedSemanticsV2({
    generationTargets,
    directResponseEvidence,
    artifacts,
    deviceType: "DESKTOP",
  });
  const selected = selectStitchTargetCandidatesV2({
    generationTargets,
    directResponseEvidence,
    artifacts,
    renderedSemantics: rendered.artifact,
  });
  assert.equal(selected.status, "produced", JSON.stringify(selected));
  if (selected.status !== "produced") throw new Error("unreachable");
  const bound = bindStitchTargetCandidateSelectionsV3({
    generationTargets,
    candidateSelection: selected.candidateSelection,
    renderedSemantics: rendered.artifact,
  });
  assert.equal(bound.status, "produced", JSON.stringify(bound));
  if (bound.status !== "produced") throw new Error("unreachable");
  const graphResult = produceDesignInteractionGraphV2({
    productSpec,
    generationTargets,
    renderedSemantics: rendered.artifact,
    candidateSelection: selected.candidateSelection,
    responseBindings: bound.responseBindings,
  });
  assert.equal(graphResult.status, "produced", JSON.stringify(graphResult));
  if (graphResult.status !== "produced") throw new Error("unreachable");
  const designGraph = graphResult.designGraph;

  const renderedCandidate = rendered.artifact.candidates.find((candidate) =>
    candidate.screenId === screenId);
  assert.equal(renderedCandidate?.status, "rendered");
  if (!renderedCandidate || renderedCandidate.status !== "rendered" || !renderedCandidate.semanticDom) {
    throw new Error("unreachable");
  }
  const graphControl = designGraph.controls[0]!;
  const physicalControl = {
    id: "start-game-control",
    generatedLocalId: "start-game-control",
    kind: graphControl.nativeControlKind ?? "button",
    label: "Start Game",
    sourceElementRef: graphControl.elementRef,
    sourceLocator: renderedCandidate.semanticDom.locator,
    generatedSourceLocator: GENERATED_PATH,
    selector: '[data-action-id="start-game-control"]',
    semanticSource: "data-action" as const,
    actionRef: graphControl.identity.actionRef,
    controlSlotRef: graphControl.identity.controlSlotRef,
    surfaceRef: graphControl.identity.surfaceRef,
    physicalControlRef: graphControl.id,
    affectedSurfaceRefs: designGraph.actions[0]!.affectedSurfaceRefs,
    tagName: graphControl.tagName,
    nativeControlKind: graphControl.nativeControlKind,
    role: graphControl.role,
    ariaLabel: graphControl.ariaLabel,
    interactiveRole: graphControl.interactiveRole,
    href: graphControl.href,
  };
  const observables: StitchScreenIndexEntryV2["observables"] = designGraph.observables.map((observable) => {
    const element = observable.elementBindings[0]!;
    const readonlyDisplay = options.readonlyTextbox && observable.selector.kind === "accessibility";
    if (readonlyDisplay) {
      const native = renderedCandidate.elements.find((entry) => entry.elementRef === element.elementRef)!;
      assert.equal(native.tagName, "input");
      assert.deepEqual(native.nativeInputState, { inputType: "text", readOnly: true, contentEditable: false });
    }
    return {
      observableRef: observable.observableRef,
      actionRef: observable.actionRef,
      selectorKind: observable.selector.kind,
      ...(observable.selector.kind === "control"
        ? { controlSlotRef: observable.selector.controlSlotRef }
        : { surfaceRef: observable.selector.surfaceRef }),
      ...(observable.selector.kind === "accessibility"
        ? { role: observable.selector.role, name: observable.selector.name }
        : {}),
      evidenceRef: observable.evidenceRef,
      sourceElementRef: element.elementRef,
      sourceLocator: renderedCandidate.semanticDom.locator,
      generatedSourceLocator: GENERATED_PATH,
      selector: `[data-observable-refs~="${observable.observableRef}"]`,
      ...(readonlyDisplay ? { readonlyDisplay: { kind: "input" as const, inputType: "text" as const, readOnly: true as const } } : {}),
    };
  });
  const rejectedInput = options.readonlyTextbox
    ? renderedCandidate.elements.find((element) => element.tagName === "input" && element.ariaLabel === "Undeclared adjacent input")
    : undefined;
  if (options.readonlyTextbox) assert.ok(rejectedInput);
  const rejectedControls: StitchScreenIndexEntryV2["rejectedControls"] = rejectedInput ? [{
    rejectionId: "undeclared-adjacent-input", kind: "input", label: "Undeclared adjacent input", index: 1,
    reasonCode: "outside_canonical_rendered_contract", sourceElementRef: rejectedInput.elementRef,
    sourceLocator: renderedCandidate.semanticDom.locator, generatedSourceLocator: GENERATED_PATH,
    selector: '[data-setfarm-rejected-control="undeclared-adjacent-input"]',
  }] : [];
  const inputCount = renderedCandidate.elements.filter((element) => element.tagName === "input").length;
  const { generatedSourceLocator: _generatedSourceLocator, ...physicalAction } = physicalControl;
  const screenIndex = StitchScreenIndexV2Schema.parse([{
    screenId,
    title: target.expectedScreenTitle,
    componentName: "PlayPage",
    file: GENERATED_PATH,
    buttons: 1,
    inputs: inputCount,
    textareas: 0,
    selects: 0,
    links: 0,
    actions: [physicalAction],
    controls: [physicalControl],
    observables,
    projection: {
      schema: "setfarm.stitch-screen-projection.v2",
      mode: "contract_only",
      targetRef: target.targetId,
      authoritySchema: "setfarm.design-interaction-graph.v2",
      rawInteractiveCounts: { buttons: 1, links: 0, inputs: inputCount, textareas: 0, selects: 0 },
      requiredObservableRefs: observables.map((observable) => observable.observableRef).sort(),
    },
    componentApi: {
      schema: "setfarm.generated-screen-component-api.v1",
      actionsPropName: "actions",
      actionBindings: [{
        generatedLocalId: physicalControl.generatedLocalId,
        actionRef: physicalControl.actionRef,
        inputFields: [],
      }],
      inputTransports: [],
    },
    rejectedControls,
  }]);

  const observableGroups = new Map<string, StitchScreenIndexEntryV2["observables"]>();
  for (const observable of observables) {
    const group = observableGroups.get(observable.sourceElementRef) ?? [];
    group.push(observable);
    observableGroups.set(observable.sourceElementRef, group);
  }
  const controlObservables = observableGroups.get(physicalControl.sourceElementRef) ?? [];
  const controlObservableRefs = controlObservables
    .map((observable) => observable.observableRef)
    .sort()
    .join(" ");
  const controlSurface = controlObservables.find((observable) =>
    observable.selectorKind === "surface");
  const controlAccessibility = controlObservables.find((observable) =>
    observable.selectorKind === "accessibility");
  const physicalRole = controlAccessibility?.role ?? physicalControl.role;
  const physicalAriaLabel = controlAccessibility?.name ?? physicalControl.ariaLabel;
  const physicalHandler = physicalControl.kind === "button" || physicalControl.kind === "link"
    ? "onClick"
    : "onChange";
  const physicalAttributes = [
    `data-action-id=${JSON.stringify(physicalControl.generatedLocalId)}`,
    `data-action=${JSON.stringify(physicalControl.actionRef)}`,
    `data-control-slot=${JSON.stringify(physicalControl.controlSlotRef)}`,
    `data-setfarm-element-ref=${JSON.stringify(physicalControl.sourceElementRef)}`,
    ...(controlObservableRefs.length > 0
      ? [`data-observable-refs=${JSON.stringify(controlObservableRefs)}`]
      : []),
    ...(controlSurface?.surfaceRef
      ? [`data-surface-id=${JSON.stringify(controlSurface.surfaceRef)}`]
      : []),
    ...(physicalRole ? [`role=${JSON.stringify(physicalRole)}`] : []),
    ...(physicalAriaLabel ? [`aria-label=${JSON.stringify(physicalAriaLabel)}`] : []),
    ...(physicalControl.href ? [`href=${JSON.stringify(physicalControl.href)}`] : []),
    `${physicalHandler}={actions?.[${JSON.stringify(physicalControl.generatedLocalId)}]}`,
  ];
  const generatedObservableElements = [...observableGroups.entries()]
    .filter(([elementRef]) => elementRef !== physicalControl.sourceElementRef)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([elementRef, bindings]) => {
      const surface = bindings.find((observable) => observable.selectorKind === "surface");
      const accessibility = bindings.find((observable) =>
        observable.selectorKind === "accessibility");
      const readonlyDisplay = bindings.some((observable) => observable.readonlyDisplay);
      const tagName = readonlyDisplay ? "input" : accessibility ? "output" : "section";
      const attributes = [
        `data-observable-refs=${JSON.stringify(bindings
          .map((observable) => observable.observableRef)
          .sort()
          .join(" "))}`,
        `data-setfarm-element-ref=${JSON.stringify(elementRef)}`,
        ...(surface?.surfaceRef
          ? [`data-surface-id=${JSON.stringify(surface.surfaceRef)}`]
          : []),
        ...(accessibility?.role ? [`role=${JSON.stringify(accessibility.role)}`] : []),
        ...(accessibility?.name ? [`aria-label=${JSON.stringify(accessibility.name)}`] : []),
      ];
      return readonlyDisplay
        ? `      <input ${attributes.join(" ")} type="text" readOnly={true} value="Playing" />`
        : `      <${tagName} ${attributes.join(" ")}>Evidence</${tagName}>`;
    });
  const generatedSourceText = [
    "export function PlayPage({ actions }: { actions?: Record<string, () => void> }) {",
    "  return (",
    "    <main>",
    `      <${physicalControl.tagName} ${physicalAttributes.join(" ")}>Start Game</${physicalControl.tagName}>`,
    ...generatedObservableElements,
    ...rejectedControls.map((control) => `      <input disabled hidden={true} aria-hidden={true} aria-label="Undeclared adjacent input" data-setfarm-element-ref=${JSON.stringify(control.sourceElementRef)} data-setfarm-rejected-control=${JSON.stringify(control.rejectionId)} />`),
    "    </main>",
    "  );",
    "}",
    "",
  ].join("\n");
  const generatedSourceHash = sha256(generatedSourceText);
  const buildTopology = topologyFor(productSpec, generatedSourceHash);
  const storyResult = produceStoryPlanV2({ productSpec, designGraph, buildTopology });
  assert.equal(storyResult.status, "produced", JSON.stringify(storyResult));
  if (storyResult.status !== "produced") throw new Error("unreachable");
  const screenIndexText = JSON.stringify(screenIndex, null, 2);
  const converterText = "// exact test converter source\n";

  return {
    designSourceKind: "stitch" as const,
    productSpec,
    designGraph,
    buildTopology,
    storyPlan: storyResult.storyPlan,
    designSourceClosure: stitchClosure({
      generationTargets,
      responseBindings: bound.responseBindings,
      designGraph,
    }),
    generationTargets,
    responseBindings: bound.responseBindings,
    screenIndex,
    screenIndexSource: {
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: sha256(screenIndexText),
        mediaType: "application/json",
        locator: "src/screens/SCREEN_INDEX.json",
        byteLength: Buffer.byteLength(screenIndexText, "utf8"),
      },
      text: screenIndexText,
    },
    converterSource: {
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: sha256(converterText),
        mediaType: "text/javascript",
        locator: "scripts/stitch-to-jsx.mjs",
        byteLength: Buffer.byteLength(converterText, "utf8"),
      },
      text: converterText,
    },
    generatedSources: [{
      targetRef: target.targetId,
      responseScreenId: screenId,
      pathRef: "PATH_PLAY_PAGE",
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: generatedSourceHash,
        mediaType: "text/typescript",
        locator: GENERATED_PATH,
        byteLength: Buffer.byteLength(generatedSourceText, "utf8"),
      },
      text: generatedSourceText,
    }],
  };
}

function writePrivateSourceMapJson(root: string, name: string, value: unknown): void {
  fs.writeFileSync(path.join(root, name), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
}

function rebindScreenIndexSource(input: Awaited<ReturnType<typeof exactStitchInput>>): void {
  input.screenIndexSource.text = JSON.stringify(input.screenIndex, null, 2);
  input.screenIndexSource.source.hash = sha256(input.screenIndexSource.text);
  input.screenIndexSource.source.byteLength = Buffer.byteLength(input.screenIndexSource.text, "utf8");
}

// These cases exercise REAL capture via exactStitchInput. Builder authors only;
// Root separately admits exact focused native RED/GREEN. No fixture cleanup.
async function verifyReadonlySourceMap(sharedReadonlyObservable: boolean): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-source-map-readonly-W1-"));
  try {
    fs.chmodSync(root, 0o700);
    writePrivateSourceMapJson(root, "options.json", { readonlyTextbox: true, sharedReadonlyObservable });
    const input = await exactStitchInput({ readonlyTextbox: true, sharedReadonlyObservable });
    writePrivateSourceMapJson(root, "input.json", input);
    const result = produceImplementationSourceMapV1(input);
    // Preserve genuine original input/result before the first producer success
    // assertion, including its expected pre-fix OUTPUT_INVALID cardinality RED.
    writePrivateSourceMapJson(root, "result.json", result);
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") throw new Error("unreachable");
    const sourceMap = ImplementationSourceMapV1Schema.parse(result.sourceMap);
    assert.equal(sourceMap.designSourceKind, "stitch");
    if (sourceMap.designSourceKind !== "stitch") throw new Error("unreachable");
    const indexed = input.screenIndex[0]!;
    const screen = sourceMap.screens[0]!;
    const displayObservables = indexed.observables.filter((observable) => observable.readonlyDisplay);
    assert.equal(displayObservables.length, sharedReadonlyObservable ? 2 : 1);
    assert.equal(new Set(displayObservables.map((observable) => observable.sourceElementRef)).size, 1);
    assert.deepEqual(indexed.projection.rawInteractiveCounts, { buttons: 1, links: 0, inputs: 2, textareas: 0, selects: 0 });
    assert.equal(indexed.inputs, 2);
    assert.deepEqual(screen.cardinality, {
      raw: { buttons: 1, links: 0, inputs: 2, textareas: 0, selects: 0 },
      accepted: { buttons: 1, links: 0, inputs: 1, textareas: 0, selects: 0 },
      rejected: { buttons: 0, links: 0, inputs: 1, textareas: 0, selects: 0 },
    });
    assert.equal(screen.controls.length, 1);
    assert.equal(indexed.controls.length, 1);
    assert.deepEqual(screen.actionInputs, []);
    assert.deepEqual(screen.componentApi.inputTransports, []);
    assert.deepEqual(screen.componentApi, indexed.componentApi);
    assert.equal(screen.rejectedControls.length, 1);
    assert.equal(screen.controls.some((control) => control.sourceElementRef === displayObservables[0]!.sourceElementRef), false);
    assert.equal(screen.rejectedControls.some((control) => control.contract.sourceElementRef === displayObservables[0]!.sourceElementRef), false);
    assert.equal(sourceMap.screenIndexV2PayloadHash, hashCanonicalJson(input.screenIndex));
    assert.equal(sourceMap.screenIndexSourceHash, sha256(input.screenIndexSource.text));
    assert.equal(sourceMap.screenIndexSourceHash, input.screenIndexSource.source.hash);
    assert.deepEqual(JSON.parse(input.screenIndexSource.text), input.screenIndex);
    assert.equal(result.payloadHash, implementationSourceMapPayloadHashV1(sourceMap));

    const mutations: [string, (copy: any) => void][] = [
      ["missing-metadata", (copy) => { delete copy.screenIndex[0].observables.find((observable: any) => observable.readonlyDisplay).readonlyDisplay; }],
      ["wrong-metadata", (copy) => { copy.screenIndex[0].observables.find((observable: any) => observable.readonlyDisplay).readonlyDisplay.inputType = "number"; }],
      ["overlapping-metadata", (copy) => { copy.screenIndex[0].rejectedControls[0].sourceElementRef = displayObservables[0]!.sourceElementRef; }],
      ["inconsistent-count", (copy) => { copy.screenIndex[0].inputs = 3; copy.screenIndex[0].projection.rawInteractiveCounts.inputs = 3; }],
    ];
    for (const [name, mutate] of mutations) {
      const copy = structuredClone(input);
      mutate(copy);
      // Keep exact index bytes/ref current: the metadata/count contract, not
      // unrelated stale artifact bytes, must cause these rejections.
      rebindScreenIndexSource(copy);
      writePrivateSourceMapJson(root, `${name}-input.json`, copy);
      const rejected = produceImplementationSourceMapV1(copy);
      writePrivateSourceMapJson(root, `${name}-result.json`, rejected);
      assert.equal(rejected.status, "rejected", name);
      if (rejected.status !== "rejected") throw new Error("unreachable");
      assert.deepEqual(rejected.rejectionCodes, ["IMPLEMENTATION_SOURCE_MAP_V1_INPUT_INVALID"], name);
      assert.ok(rejected.diagnostics.every((diagnostic) => diagnostic.reference?.startsWith("screenIndex/")), name);
    }
  } catch (error) {
    writePrivateSourceMapJson(root, "failure.json", { message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    console.log(JSON.stringify({ code: "IMPLEMENTATION_SOURCE_MAP_READONLY_W1_FIXTURE_RETAINED", path: root, sharedReadonlyObservable }));
  }
}

describe("ImplementationSourceMapV1", { concurrency: 1 }, () => {
  it("accounts a readonly textbox plus adjacent rejected input in the genuine source-map producer", async () => {
    await verifyReadonlySourceMap(false);
  });

  it("counts shared readonly textbox observables once in the genuine source-map producer", async () => {
    await verifyReadonlySourceMap(true);
  });

  it("materializes exact Stitch screen, source, owner, control, and observable mappings deterministically", async () => {
    const input = await exactStitchInput();
    const first = produceImplementationSourceMapV1(input);
    const second = produceImplementationSourceMapV1(structuredClone(input));
    assert.equal(first.status, "produced", JSON.stringify(first));
    assert.equal(second.status, "produced", JSON.stringify(second));
    if (first.status !== "produced" || second.status !== "produced") return;
    assert.deepEqual(second.sourceMap, first.sourceMap);
    assert.equal(second.payloadHash, first.payloadHash);
    assert.equal(first.payloadHash, implementationSourceMapPayloadHashV1(first.sourceMap));
    assert.deepEqual(ImplementationSourceMapV1Schema.parse(first.sourceMap), first.sourceMap);
    assert.equal(first.sourceMap.designSourceKind, "stitch");
    if (first.sourceMap.designSourceKind !== "stitch") return;
    assert.equal(first.sourceMap.productSpecV2PayloadHash, hashCanonicalJson(input.productSpec));
    assert.equal(first.sourceMap.designGraphV2PayloadHash, hashCanonicalJson(input.designGraph));
    assert.equal(first.sourceMap.buildTopologyV1PayloadHash, hashCanonicalJson(input.buildTopology));
    assert.equal(first.sourceMap.storyPlanV2PayloadHash, hashCanonicalJson(input.storyPlan));
    assert.equal(
      first.sourceMap.designSourceClosureV2PayloadHash,
      hashCanonicalJson(input.designSourceClosure),
    );
    assert.equal(first.sourceMap.screenIndexV2PayloadHash, hashCanonicalJson(input.screenIndex));
    assert.equal(first.sourceMap.screenIndexSourceHash, input.screenIndexSource.source.hash);
    assert.deepEqual(first.sourceMap.converter, {
      schema: "setfarm.implementation-source-converter.v1",
      converterId: "setfarm.stitch-to-jsx",
      contractVersion: 1,
      componentApiSchema: "setfarm.generated-screen-component-api.v1",
      sourceHash: input.converterSource.source.hash,
      sourceByteLength: input.converterSource.source.byteLength,
    });
    assert.equal(first.sourceMap.screens.length, 1);
    const screen = first.sourceMap.screens[0]!;
    assert.equal(screen.pathRef, "PATH_PLAY_PAGE");
    assert.equal(screen.path, GENERATED_PATH);
    assert.equal(screen.contentHash, input.generatedSources[0]!.source.hash);
    assert.equal(screen.sourceByteLength, input.generatedSources[0]!.source.byteLength);
    assert.equal(screen.componentName, "PlayPage");
    assert.deepEqual(screen.componentApi, input.screenIndex[0]!.componentApi);
    assert.equal(screen.targetHash, hashCanonicalJson(input.generationTargets.targets[0]));
    assert.equal(screen.responseBindingHash, hashCanonicalJson(input.responseBindings.bindings[0]));
    assert.equal(screen.storyId, "US-001");
    assert.equal(screen.ownerRef, "OWNER_US_001");
    assert.equal(screen.controls.length, 1, "affected surfaces cannot mint controls");
    assert.equal(screen.controls[0]!.controlSlotRef, input.designGraph.controls[0]!.identity.controlSlotRef);
    assert.equal(screen.controls[0]!.generatedLocalId, "start-game-control");
    assert.equal(screen.controls[0]!.generatedSelector, '[data-action-id="start-game-control"]');
    assert.deepEqual(screen.controls[0]!.handlerBinding, {
      actionsPropName: "actions",
      callbackKey: "start-game-control",
      event: "click",
      preventsDefault: false,
      inputFields: [],
    });
    assert.deepEqual(screen.cardinality, {
      raw: { buttons: 1, links: 0, inputs: 0, textareas: 0, selects: 0 },
      accepted: { buttons: 1, links: 0, inputs: 0, textareas: 0, selects: 0 },
      rejected: { buttons: 0, links: 0, inputs: 0, textareas: 0, selects: 0 },
    });
    assert.deepEqual(
      screen.containedSurfaces.map((surface) => surface.surfaceRef),
      [...input.generationTargets.targets[0]!.containedSurfaceRefs].sort(),
    );
    assert.deepEqual(
      screen.observables.map((observable) => observable.observableRef),
      input.designGraph.observables.map((observable) => observable.observableRef).sort(),
    );
    for (const observable of screen.observables) {
      const graphObservable = input.designGraph.observables.find((candidate) =>
        candidate.observableRef === observable.observableRef)!;
      assert.equal(observable.generatedSelector, `[data-observable-refs~="${observable.observableRef}"]`);
      assert.equal(observable.assertionsHash, graphObservable.assertionsHash);
    }
  });

  it("emits an explicit empty no-design branch without fabricating screen mappings", () => {
    const productSpec = buildNoDesignProductBuildPacketV3Contracts().productSpecV2;
    const buildTopology = topologyFor(productSpec);
    const story = produceStoryPlanV2({ productSpec, buildTopology });
    assert.equal(story.status, "produced", JSON.stringify(story));
    if (story.status !== "produced") return;
    const result = produceImplementationSourceMapV1({
      designSourceKind: "none",
      productSpec,
      designGraph: null,
      buildTopology,
      storyPlan: story.storyPlan,
      designSourceClosure: noDesignClosure(),
      generationTargets: null,
      responseBindings: null,
      screenIndex: [],
      screenIndexSource: null,
      converterSource: null,
      generatedSources: [],
    });
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    assert.equal(result.sourceMap.designSourceKind, "none");
    assert.equal(result.sourceMap.designGraphV2PayloadHash, null);
    assert.equal(
      result.sourceMap.designSourceClosureV2PayloadHash,
      hashCanonicalJson(noDesignClosure()),
    );
    assert.equal(result.sourceMap.screenIndexV2PayloadHash, null);
    assert.equal(result.sourceMap.screenIndexSourceHash, null);
    assert.equal(result.sourceMap.converter, null);
    assert.deepEqual(result.sourceMap.screens, []);
  });

  it("rejects caller-selected no-design authority for a design-required ProductSpec", () => {
    const productSpec = buildContainedGameProductSpecV2();
    const buildTopology = topologyFor(productSpec);
    const story = produceStoryPlanV2({ productSpec, buildTopology });
    assert.equal(story.status, "produced", JSON.stringify(story));
    if (story.status !== "produced") return;
    const result = produceImplementationSourceMapV1({
      designSourceKind: "none",
      productSpec,
      designGraph: null,
      buildTopology,
      storyPlan: story.storyPlan,
      designSourceClosure: noDesignClosure(),
      generationTargets: null,
      responseBindings: null,
      screenIndex: [],
      screenIndexSource: null,
      converterSource: null,
      generatedSources: [],
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(
      result.rejectionCodes.includes(
        "IMPLEMENTATION_SOURCE_MAP_V1_DELIVERY_KIND_MISMATCH",
      ),
      true,
    );
  });

  it("keeps the payload fingerprint distinct from producer-bound CAS envelope identity", async () => {
    const input = await exactStitchInput();
    const result = produceImplementationSourceMapV1(input);
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    const envelope = (codeSha: string) => hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.implementation-source-map.v1",
      producer: {
        pass: "implementation-source-map-v1",
        codeSha,
        toolVersions: { setfarm: "2.3.79" },
      },
      payload: result.sourceMap,
    });
    assert.notEqual(result.payloadHash, envelope("a".repeat(40)));
    assert.notEqual(envelope("a".repeat(40)), envelope("b".repeat(40)));
    assert.equal(result.payloadHash, implementationSourceMapPayloadHashV1(result.sourceMap));
  });

  it("rejects stale authority hashes and missing, extra, or ambiguous generated mappings", async () => {
    const input = await exactStitchInput();
    const stale: any = structuredClone(input);
    stale.storyPlan.productSpecHash = "f".repeat(64);
    const staleResult = produceImplementationSourceMapV1(stale);
    assert.equal(staleResult.status, "rejected");
    if (staleResult.status === "rejected") {
      assert.equal(
        staleResult.rejectionCodes.includes("IMPLEMENTATION_SOURCE_MAP_V1_PRODUCT_SPEC_HASH_MISMATCH"),
        true,
      );
    }

    const staleClosure: any = structuredClone(input);
    staleClosure.designSourceClosure.generationTargets.payloadHash = "0".repeat(64);
    const staleClosureResult = produceImplementationSourceMapV1(staleClosure);
    assert.equal(staleClosureResult.status, "rejected");
    if (staleClosureResult.status === "rejected") {
      assert.equal(
        staleClosureResult.rejectionCodes.includes(
          "IMPLEMENTATION_SOURCE_MAP_V1_DESIGN_SOURCE_CLOSURE_HASH_MISMATCH",
        ),
        true,
      );
    }

    const reformattedIndex: any = structuredClone(input);
    reformattedIndex.screenIndexSource.text += "\n";
    reformattedIndex.screenIndexSource.source.hash = sha256(reformattedIndex.screenIndexSource.text);
    reformattedIndex.screenIndexSource.source.byteLength = Buffer.byteLength(
      reformattedIndex.screenIndexSource.text,
      "utf8",
    );
    const reformattedIndexResult = produceImplementationSourceMapV1(reformattedIndex);
    assert.equal(reformattedIndexResult.status, "produced", JSON.stringify(reformattedIndexResult));
    const originalIndexResult = produceImplementationSourceMapV1(input);
    assert.equal(originalIndexResult.status, "produced", JSON.stringify(originalIndexResult));
    if (
      reformattedIndexResult.status === "produced"
      && originalIndexResult.status === "produced"
    ) {
      assert.equal(
        reformattedIndexResult.sourceMap.screenIndexV2PayloadHash,
        originalIndexResult.sourceMap.screenIndexV2PayloadHash,
      );
      assert.notEqual(
        reformattedIndexResult.sourceMap.screenIndexSourceHash,
        originalIndexResult.sourceMap.screenIndexSourceHash,
      );
    }

    const selectorDrift: any = structuredClone(input);
    selectorDrift.screenIndex[0].controls[0].selector = "#fabricated-selector";
    selectorDrift.screenIndex[0].actions[0].selector = "#fabricated-selector";
    selectorDrift.screenIndexSource.text = JSON.stringify(selectorDrift.screenIndex, null, 2);
    selectorDrift.screenIndexSource.source.hash = sha256(selectorDrift.screenIndexSource.text);
    selectorDrift.screenIndexSource.source.byteLength = Buffer.byteLength(
      selectorDrift.screenIndexSource.text,
      "utf8",
    );
    const selectorDriftResult = produceImplementationSourceMapV1(selectorDrift);
    assert.equal(selectorDriftResult.status, "rejected");
    if (selectorDriftResult.status === "rejected") {
      assert.equal(
        selectorDriftResult.rejectionCodes.includes(
          "IMPLEMENTATION_SOURCE_MAP_V1_CONTROL_IDENTITY_MISMATCH",
        ),
        true,
        JSON.stringify(selectorDriftResult),
      );
    }

    const staleSource: any = structuredClone(input);
    staleSource.generatedSources[0].source.hash = "e".repeat(64);
    const staleSourceResult = produceImplementationSourceMapV1(staleSource);
    assert.equal(staleSourceResult.status, "rejected");
    if (staleSourceResult.status === "rejected") {
      assert.equal(
        staleSourceResult.rejectionCodes.includes("IMPLEMENTATION_SOURCE_MAP_V1_SOURCE_OWNERSHIP_MISMATCH"),
        true,
      );
    }

    const handlerDrift: any = structuredClone(input);
    handlerDrift.generatedSources[0].text = handlerDrift.generatedSources[0].text.replace(
      'actions?.["start-game-control"]',
      'actions?.["wrong-control"]',
    );
    handlerDrift.generatedSources[0].source.hash = sha256(handlerDrift.generatedSources[0].text);
    handlerDrift.generatedSources[0].source.byteLength = Buffer.byteLength(
      handlerDrift.generatedSources[0].text,
      "utf8",
    );
    const handlerDriftResult = produceImplementationSourceMapV1(handlerDrift);
    assert.equal(handlerDriftResult.status, "rejected");
    if (handlerDriftResult.status === "rejected") {
      assert.equal(
        handlerDriftResult.rejectionCodes.includes(
          "IMPLEMENTATION_SOURCE_MAP_V1_GENERATED_SOURCE_CONTRACT_INVALID",
        ),
        true,
      );
    }

    const physicalDrift: any = structuredClone(input);
    physicalDrift.screenIndex[0].controls[0].tagName = "a";
    physicalDrift.screenIndex[0].actions[0].tagName = "a";
    physicalDrift.screenIndexSource.text = JSON.stringify(physicalDrift.screenIndex, null, 2);
    physicalDrift.screenIndexSource.source.hash = sha256(physicalDrift.screenIndexSource.text);
    physicalDrift.screenIndexSource.source.byteLength = Buffer.byteLength(
      physicalDrift.screenIndexSource.text,
      "utf8",
    );
    const physicalDriftResult = produceImplementationSourceMapV1(physicalDrift);
    assert.equal(physicalDriftResult.status, "rejected");
    if (physicalDriftResult.status === "rejected") {
      assert.equal(
        physicalDriftResult.rejectionCodes.includes("IMPLEMENTATION_SOURCE_MAP_V1_CONTROL_IDENTITY_MISMATCH"),
        true,
      );
    }

    const missing: any = structuredClone(input);
    missing.generatedSources = [];
    const missingResult = produceImplementationSourceMapV1(missing);
    assert.equal(missingResult.status, "rejected");

    const extra: any = structuredClone(input);
    extra.generatedSources.push({
      ...structuredClone(extra.generatedSources[0]),
      targetRef: "TARGET_UNAUTHORIZED",
      responseScreenId: "screen-unauthorized",
      pathRef: "PATH_UNAUTHORIZED",
      source: {
        ...structuredClone(extra.generatedSources[0].source),
        locator: "src/screens/Unauthorized.tsx",
      },
    });
    const extraResult = produceImplementationSourceMapV1(extra);
    assert.equal(extraResult.status, "rejected");
    if (extraResult.status === "rejected") {
      assert.equal(
        extraResult.rejectionCodes.includes("IMPLEMENTATION_SOURCE_MAP_V1_TARGET_MAPPING_EXTRA"),
        true,
      );
    }

    const ambiguous: any = structuredClone(input);
    ambiguous.generatedSources.push(structuredClone(ambiguous.generatedSources[0]));
    const ambiguousResult = produceImplementationSourceMapV1(ambiguous);
    assert.equal(ambiguousResult.status, "rejected");
    if (ambiguousResult.status === "rejected") {
      assert.equal(
        ambiguousResult.rejectionCodes.includes("IMPLEMENTATION_SOURCE_MAP_V1_MAPPING_AMBIGUOUS"),
        true,
      );
    }
  });

  it("schema rejects noncanonical ordering, selector-hash drift, and extra fields", async () => {
    const input = await exactStitchInput();
    const result = produceImplementationSourceMapV1(input);
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced" || result.sourceMap.designSourceKind !== "stitch") return;

    const reordered: any = structuredClone(result.sourceMap);
    reordered.screens[0].containedSurfaces.reverse();
    assert.equal(ImplementationSourceMapV1Schema.safeParse(reordered).success, false);

    const staleSelector: any = structuredClone(result.sourceMap);
    staleSelector.screens[0].observables[0].selectorHash = "0".repeat(64);
    assert.equal(ImplementationSourceMapV1Schema.safeParse(staleSelector).success, false);

    const extra: any = structuredClone(result.sourceMap);
    extra.screens[0].agentHint = "invent a screen";
    assert.equal(ImplementationSourceMapV1Schema.safeParse(extra).success, false);
  });
});
