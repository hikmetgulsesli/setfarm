import { createHash } from "node:crypto";

import { hashCanonicalJson } from "../../../src/product-compiler/canonical-json.js";
import { compilePlanSemanticProposalV2 } from "../../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { produceDesignInteractionGraphV2 } from "../../../src/product-compiler/producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../../src/product-compiler/producers/design-targets-v2.js";
import type { ImplementationSourceMapProducerInputV1 } from "../../../src/product-compiler/producers/implementation-source-map-v1.js";
import { captureStitchRenderedSemanticsV2 } from "../../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
} from "../../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import { produceStoryPlanV2 } from "../../../src/product-compiler/producers/story-plan-v2.js";
import { BuildTopologyV1Schema } from "../../../src/product-compiler/schemas/build-topology-v1.js";
import { ProductSpecV2Schema } from "../../../src/product-compiler/schemas/product-spec-v2.js";
import { StitchScreenIndexV2Schema } from "../../../src/product-compiler/schemas/stitch-screen-index-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./stitch-artifacts.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function topologyFor(
  productSpecV2: any,
  entrypointKind: "cli" | "game",
  knownContentHash = "e".repeat(64),
) {
  return BuildTopologyV1Schema.parse({
    schema: "setfarm.build-topology.v1",
    stackPack: {
      id: entrypointKind === "cli" ? "node-cli" : "browser-game",
      version: "1.0.0",
      contentHash: "a".repeat(64),
    },
    repo: {
      id: "packet-compiler-v3-test",
      baseSha: "b".repeat(40),
      treeHash: "d".repeat(40),
    },
    owners: [{ id: "OWNER_US_001", kind: "story", storyRef: "US-001" }],
    pathBindings: [{
      id: "PATH_APP",
      path: entrypointKind === "cli" ? "src/index.ts" : "src/App.tsx",
      role: entrypointKind === "game" ? "generated" : "source",
      ownerRef: "OWNER_US_001",
      presence: "present",
      knownContentHash,
    }],
    sharedGrants: [],
    entrypoints: [{
      id: entrypointKind === "cli" ? "ENTRY_CLI" : "ENTRY_GAME",
      kind: entrypointKind,
      pathRef: "PATH_APP",
      mountPoint: entrypointKind === "cli" ? "." : "/play",
      routeRefs: productSpecV2.routes.map((route: any) => route.id).sort(),
    }],
    commands: [{
      id: "CMD_BUILD",
      kind: "build",
      argv: ["npm", "run", "build"],
      cwd: ".",
      timeoutMs: 120_000,
      capabilityRefs: [],
    }],
    capabilities: [{
      id: "CAP_BROWSER_INTERACTION",
      kind: "browser_interaction",
      enabled: true,
    }],
    policies: {
      packageManager: "npm",
      allowedRoots: ["src"],
      deniedGlobs: [],
      buildOutputPaths: ["dist"],
    },
  });
}

function noDesignImplementationSourceInputsV1(input: {
  productSpecV2: unknown;
  buildTopologyV1: unknown;
  storyPlanV2: unknown;
  designSourceClosureV2: unknown;
}): ImplementationSourceMapProducerInputV1 {
  return {
    designSourceKind: "none",
    productSpec: input.productSpecV2,
    designGraph: null,
    buildTopology: input.buildTopologyV1,
    storyPlan: input.storyPlanV2,
    designSourceClosure: input.designSourceClosureV2,
    generationTargets: null,
    responseBindings: null,
    screenIndex: [],
    screenIndexSource: null,
    converterSource: null,
    generatedSources: [],
  } as ImplementationSourceMapProducerInputV1;
}

function stitchImplementationProjectionV1(input: {
  productSpecV2: any;
  designGraphV2: any;
  generationTargets: any;
  responseBindings: any;
}) {
  const target = input.generationTargets.targets[0]!;
  const response = input.responseBindings.bindings.find((candidate: any) =>
    candidate.targetRef === target.targetId)!;
  const generatedPath = "src/App.tsx";
  const sourceLocator = "stitch/rendered-dom/screen-packet-v3-stitch.html";
  const controls = input.designGraphV2.controls
    .filter((control: any) => control.source.targetRef === target.targetId)
    .sort((left: any, right: any) =>
      left.identity.controlSlotRef.localeCompare(right.identity.controlSlotRef))
    .map((graphControl: any, index: number) => {
      const graphAction = input.designGraphV2.actions.find((candidate: any) =>
        candidate.actionRef === graphControl.identity.actionRef)!;
      const generatedLocalId = `control-${index + 1}`;
      const generatedKind = graphControl.nativeControlKind ?? "button";
      const productAction = input.productSpecV2.actions.find((candidate: any) =>
        candidate.id === graphControl.identity.actionRef)!;
      return {
        id: generatedLocalId,
        generatedLocalId,
        kind: generatedKind,
        label: productAction.name,
        sourceElementRef: graphControl.elementRef,
        sourceLocator,
        generatedSourceLocator: generatedPath,
        selector: `[data-action-id="${generatedLocalId}"]`,
        semanticSource: "data-action" as const,
        actionRef: graphControl.identity.actionRef,
        controlSlotRef: graphControl.identity.controlSlotRef,
        surfaceRef: graphControl.identity.surfaceRef,
        physicalControlRef: graphControl.id,
        affectedSurfaceRefs: graphAction.affectedSurfaceRefs,
        tagName: graphControl.tagName,
        nativeControlKind: graphControl.nativeControlKind,
        role: graphControl.role,
        ariaLabel: graphControl.ariaLabel,
        interactiveRole: graphControl.interactiveRole,
        href: graphControl.href,
        inputFields: productAction.input.fields
        .map((field: any) => field.name)
        .sort(),
      };
    });
  const observables = input.designGraphV2.observables
    .filter((observable: any) => observable.source.targetRef === target.targetId)
    .sort((left: any, right: any) => left.observableRef.localeCompare(right.observableRef))
    .map((observable: any) => {
      const element = observable.elementBindings[0]!;
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
        sourceLocator,
        generatedSourceLocator: generatedPath,
        selector: `[data-observable-refs~="${observable.observableRef}"]`,
      };
    });
  const rawCounts = { buttons: 0, links: 0, inputs: 0, textareas: 0, selects: 0 };
  for (const control of controls) {
    const field = control.kind === "button"
      ? "buttons"
      : control.kind === "link"
        ? "links"
        : control.kind === "input"
          ? "inputs"
          : control.kind === "textarea"
            ? "textareas"
            : "selects";
    rawCounts[field] += 1;
  }
  const screenIndex = StitchScreenIndexV2Schema.parse([{
    screenId: response.responseScreenId,
    title: response.responseTitle,
    componentName: "App",
    file: generatedPath,
    ...rawCounts,
    actions: controls.map(({ generatedSourceLocator: _generated, inputFields: _inputs, ...control }) =>
      control),
    controls: controls.map(({ inputFields: _inputFields, ...control }) => control),
    observables,
    projection: {
      schema: "setfarm.stitch-screen-projection.v2",
      mode: "contract_only",
      targetRef: target.targetId,
      authoritySchema: "setfarm.design-interaction-graph.v2",
      rawInteractiveCounts: rawCounts,
      requiredObservableRefs: observables.map((observable: any) => observable.observableRef).sort(),
    },
    componentApi: {
      schema: "setfarm.generated-screen-component-api.v1",
      actionsPropName: "actions",
      actionBindings: controls.map((control) => ({
        generatedLocalId: control.generatedLocalId,
        actionRef: control.actionRef,
        inputFields: control.inputFields,
      })),
      inputTransports: [],
    },
    rejectedControls: [],
  }]);
  const observablesByElement = new Map<string, typeof observables>();
  for (const observable of observables) {
    observablesByElement.set(observable.sourceElementRef, [
      ...(observablesByElement.get(observable.sourceElementRef) ?? []),
      observable,
    ]);
  }
  const graphSurfaces = input.designGraphV2.surfaces
    .filter((surface: any) => surface.source.targetRef === target.targetId)
    .sort((left: any, right: any) => left.surfaceRef.localeCompare(right.surfaceRef));
  const graphSurfaceByElement = new Map(graphSurfaces.map((surface: any) =>
    [surface.elementRef, surface] as const));
  const controlLines = controls.map((control) => {
    const boundObservables = observablesByElement.get(control.sourceElementRef) ?? [];
    const surface = graphSurfaceByElement.get(control.sourceElementRef)
      ?? boundObservables.find((observable: any) => observable.selectorKind === "surface");
    const accessibility = boundObservables.find((observable: any) =>
      observable.selectorKind === "accessibility");
    const attributes = [
      `data-action-id=${JSON.stringify(control.generatedLocalId)}`,
      `data-action=${JSON.stringify(control.actionRef)}`,
      `data-control-slot=${JSON.stringify(control.controlSlotRef)}`,
      `data-setfarm-element-ref=${JSON.stringify(control.sourceElementRef)}`,
      ...(boundObservables.length > 0
        ? [`data-observable-refs=${JSON.stringify(boundObservables
          .map((observable: any) => observable.observableRef).sort().join(" "))}`]
        : []),
      ...(surface?.surfaceRef ? [`data-surface-id=${JSON.stringify(surface.surfaceRef)}`] : []),
      ...(accessibility?.role ? [`role=${JSON.stringify(accessibility.role)}`] : []),
      ...(accessibility?.name ? [`aria-label=${JSON.stringify(accessibility.name)}`] : []),
      `onClick={actions?.[${JSON.stringify(control.generatedLocalId)}]}`,
    ];
    return `      <${control.tagName} ${attributes.join(" ")}>${control.label}</${control.tagName}>`;
  });
  const controlElementRefs = new Set(controls.map((control) => control.sourceElementRef));
  const observableLines = [...observablesByElement.entries()]
    .filter(([elementRef]) => !controlElementRefs.has(elementRef))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([elementRef, bindings]) => {
      const control = bindings.find((observable: any) => observable.selectorKind === "control");
      const surface = graphSurfaceByElement.get(elementRef)
        ?? bindings.find((observable: any) => observable.selectorKind === "surface");
      const accessibility = bindings.find((observable: any) =>
        observable.selectorKind === "accessibility");
      const tagName = accessibility ? "output" : "section";
      const attributes = [
        `data-observable-refs=${JSON.stringify(bindings
          .map((observable: any) => observable.observableRef).sort().join(" "))}`,
        `data-setfarm-element-ref=${JSON.stringify(elementRef)}`,
        ...(control?.controlSlotRef
          ? [`data-control-slot=${JSON.stringify(control.controlSlotRef)}`]
          : []),
        ...(surface?.surfaceRef ? [`data-surface-id=${JSON.stringify(surface.surfaceRef)}`] : []),
        ...(accessibility?.role ? [`role=${JSON.stringify(accessibility.role)}`] : []),
        ...(accessibility?.name ? [`aria-label=${JSON.stringify(accessibility.name)}`] : []),
      ];
      return `      <${tagName} ${attributes.join(" ")}>Evidence</${tagName}>`;
    });
  const representedElementRefs = new Set([
    ...controls.map((control) => control.sourceElementRef),
    ...observables.map((observable: any) => observable.sourceElementRef),
  ]);
  const surfaceLines = graphSurfaces
    .filter((surface: any) => !representedElementRefs.has(surface.elementRef))
    .map((surface: any) =>
      `      <section data-surface-id=${JSON.stringify(surface.surfaceRef)} data-setfarm-element-ref=${JSON.stringify(surface.elementRef)}>Surface</section>`);
  const generatedText = [
    "export function App({ actions }: { actions?: Record<string, () => void> }) {",
    "  return (",
    "    <main>",
    ...surfaceLines,
    ...controlLines,
    ...observableLines,
    "    </main>",
    "  );",
    "}",
    "",
  ].join("\n");
  const screenIndexText = JSON.stringify(screenIndex, null, 2);
  const converterText = "// exact packet-v3 fixture converter\n";
  return {
    screenIndex,
    screenIndexSource: {
      source: {
        schema: "setfarm.source-artifact-ref.v1" as const,
        hash: sha256(screenIndexText),
        mediaType: "application/json",
        locator: "src/screens/SCREEN_INDEX.json",
        byteLength: Buffer.byteLength(screenIndexText, "utf8"),
      },
      text: screenIndexText,
    },
    converterSource: {
      source: {
        schema: "setfarm.source-artifact-ref.v1" as const,
        hash: sha256(converterText),
        mediaType: "text/javascript",
        locator: "scripts/stitch-to-jsx.mjs",
        byteLength: Buffer.byteLength(converterText, "utf8"),
      },
      text: converterText,
    },
    generatedSource: {
      targetRef: target.targetId,
      responseScreenId: response.responseScreenId,
      pathRef: "PATH_APP",
      source: {
        schema: "setfarm.source-artifact-ref.v1" as const,
        hash: sha256(generatedText),
        mediaType: "text/typescript",
        locator: generatedPath,
        byteLength: Buffer.byteLength(generatedText, "utf8"),
      },
      text: generatedText,
    },
  };
}

export function buildNoDesignProductBuildPacketV3Contracts() {
  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  if (compiled.status !== "canonicalized") {
    throw new Error(`ProductBuildPacketV3 fixture proposal rejected: ${JSON.stringify(compiled)}`);
  }
  const productSpecValue: any = structuredClone(compiled.productSpec);
  Object.assign(productSpecValue.delivery, {
    platform: "cli",
    techStack: "node-cli",
    designRequired: false,
  });
  const productSpecV2 = ProductSpecV2Schema.parse(productSpecValue);
  const buildTopologyV1 = topologyFor(productSpecV2, "cli");
  const stories = produceStoryPlanV2({
    productSpec: productSpecV2,
    buildTopology: buildTopologyV1,
  });
  if (stories.status !== "produced") {
    throw new Error(`ProductBuildPacketV3 fixture stories rejected: ${JSON.stringify(stories)}`);
  }
  const designSourceClosureV2 = {
    schema: "setfarm.design-source-closure.v2" as const,
    kind: "none" as const,
    reason: "product_delivery_design_not_required" as const,
  };
  const implementationSourceInputsV1 = noDesignImplementationSourceInputsV1({
    productSpecV2,
    buildTopologyV1,
    storyPlanV2: stories.storyPlan,
    designSourceClosureV2,
  });
  return {
    productSpecV2,
    designGraphV2: null,
    buildTopologyV1,
    storyPlanV2: stories.storyPlan,
    designSourceClosureV2,
    implementationSourceInputsV1,
  };
}

export async function buildStitchProductBuildPacketV3Contracts(producer: Readonly<{
  pass: string;
  codeSha: string;
  model?: string;
  promptHash?: string;
  toolVersions: Readonly<Record<string, string>>;
}>) {
  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  if (compiled.status !== "canonicalized") throw new Error(JSON.stringify(compiled));
  const productSpecV2 = ProductSpecV2Schema.parse(compiled.productSpec);
  const targets = produceDesignGenerationTargetsV2(productSpecV2);
  if (targets.status !== "produced") throw new Error(JSON.stringify(targets));
  const generationTargets = targets.generationTargets;
  const target = generationTargets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const statusObservable = target.requiredObservableSelectors.find((observable) =>
    observable.selector.kind === "accessibility")!;
  if (statusObservable.selector.kind !== "accessibility") throw new Error("missing status observable");
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
    surfaceRef !== statusObservable.selector.surfaceRef)!;
  const htmlBytes = validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}">`,
    `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
    `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
    `<section data-surface-id="${statusObservable.selector.surfaceRef}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
    "</main>",
  ].join(""), "packet-v3-stitch");
  const screenshotBytes = validStitchPng(241);
  const screenId = "screen-packet-v3-stitch";
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2" as const,
    projectId: "packet-v3-stitch-test",
    batches: [{
      stageId: "stage-packet-v3-stitch",
      targetRefs: [target.targetId],
      source: "direct" as const,
      candidates: [{
        screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(screenId, htmlBytes, screenshotBytes),
        identityConflicts: [],
        disposition: "admitted_renderable_screen" as const,
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
    renderedSemantics: rendered.artifact,
    artifacts,
  });
  if (selected.status !== "produced") throw new Error(JSON.stringify(selected));
  const bound = bindStitchTargetCandidateSelectionsV3({
    generationTargets,
    candidateSelection: selected.candidateSelection,
    renderedSemantics: rendered.artifact,
  });
  if (bound.status !== "produced") throw new Error(JSON.stringify(bound));
  const designGraphV2 = produceDesignInteractionGraphV2({
    productSpec: productSpecV2,
    generationTargets,
    renderedSemantics: rendered.artifact,
    candidateSelection: selected.candidateSelection,
    responseBindings: bound.responseBindings,
  }).designGraph;
  const implementationProjection = stitchImplementationProjectionV1({
    productSpecV2,
    designGraphV2,
    generationTargets,
    responseBindings: bound.responseBindings,
  });
  const buildTopologyV1 = topologyFor(
    productSpecV2,
    "game",
    implementationProjection.generatedSource.source.hash,
  );
  const stories = produceStoryPlanV2({
    productSpec: productSpecV2,
    designGraph: designGraphV2,
    buildTopology: buildTopologyV1,
  });
  if (stories.status !== "produced") throw new Error(JSON.stringify(stories));
  const typedRef = (artifactType: string, payload: unknown) => {
    const envelope = {
      schema: "setfarm.semantic-artifact-envelope.v1" as const,
      artifactType,
      producer,
      payload,
    };
    return {
      artifactType,
      envelopeHash: hashCanonicalJson(envelope),
      payloadHash: hashCanonicalJson(payload),
    };
  };
  const designSourceClosureV2 = {
    schema: "setfarm.design-source-closure.v2" as const,
    kind: "stitch" as const,
    generationTargets: typedRef("setfarm.design-generation-targets.v2", generationTargets),
    directResponseEvidence: typedRef("setfarm.stitch-direct-response-evidence.v2", directResponseEvidence),
    renderedSemantics: typedRef("setfarm.stitch-rendered-semantics.v2", rendered.artifact),
    candidateSelection: typedRef("setfarm.stitch-target-candidate-selection.v2", selected.candidateSelection),
    responseBindings: typedRef("setfarm.stitch-target-response-bindings.v3", bound.responseBindings),
    designGraph: typedRef("setfarm.design-interaction-graph.v2", designGraphV2),
    acceptedAttempt: {
      attemptRef: `PCA_${"1".repeat(64)}`,
      outputSealHash: "2".repeat(64),
    },
    artifactManifest: {
      artifactType: "setfarm.product-compilation-artifact-manifest.v1" as const,
      artifactHash: "3".repeat(64),
    },
    projectionReceipt: {
      artifactType: "setfarm.product-compilation-projection-receipt.v1" as const,
      artifactHash: "4".repeat(64),
    },
  };
  const implementationSourceInputsV1: ImplementationSourceMapProducerInputV1 = {
    designSourceKind: "stitch",
    productSpec: productSpecV2,
    designGraph: designGraphV2,
    buildTopology: buildTopologyV1,
    storyPlan: stories.storyPlan,
    designSourceClosure: designSourceClosureV2,
    generationTargets,
    responseBindings: bound.responseBindings,
    screenIndex: implementationProjection.screenIndex,
    screenIndexSource: implementationProjection.screenIndexSource,
    converterSource: implementationProjection.converterSource,
    generatedSources: [implementationProjection.generatedSource],
  };
  return {
    productSpecV2,
    designGraphV2,
    buildTopologyV1,
    storyPlanV2: stories.storyPlan,
    designSourceClosureV2,
    implementationSourceInputsV1,
    designSourceArtifactsV2: {
      generationTargets,
      directResponseEvidence,
      renderedSemantics: rendered.artifact,
      candidateSelection: selected.candidateSelection,
      responseBindings: bound.responseBindings,
    },
  };
}
