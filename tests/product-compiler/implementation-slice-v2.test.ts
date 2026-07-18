import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashRuntimeEvidenceContractV1 } from "../../src/evidence/runtime-evidence-contract-v1.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { SemanticArtifactEnvelopeV1Schema } from "../../src/product-compiler/artifact-store.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceDesignInteractionGraphV2 } from "../../src/product-compiler/producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { produceStoryPlanV2 } from "../../src/product-compiler/producers/story-plan-v2.js";
import { captureStitchRenderedSemanticsV2 } from "../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import { BuildTopologyV1Schema } from "../../src/product-compiler/schemas/build-topology-v1.js";
import { DesignSourceClosureV2Schema } from "../../src/product-compiler/schemas/design-source-closure-v2.js";
import { ImplementationSourceMapV1Schema } from "../../src/product-compiler/schemas/implementation-source-map-v1.js";
import {
  ImplementationSliceV2Schema,
  implementationActionInputTransportsHashV2,
  implementationFilesHashV2,
  implementationSliceAuthorityHashV2,
  implementationSliceHashV2,
  implementationStorySourceMapHashV1,
} from "../../src/product-compiler/schemas/implementation-slice-v2.js";
import { ProductBuildPacketV3Schema } from "../../src/product-compiler/schemas/product-build-packet-v3.js";
import {
  ProductSpecV2Schema,
  deriveActionInvocationEvidenceIdV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import { hashRuntimeDataContractV1 } from "../../src/product-compiler/schemas/runtime-data-contract-v1.js";
import {
  compileImplementationSliceV2,
  verifyImplementationSliceV2,
} from "../../src/product-compiler/slice-compiler-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import { buildNoDesignProductBuildPacketV3Contracts } from "./fixtures/product-build-packet-v3.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

function sha(label: string): string {
  return hashCanonicalJson({ label });
}

const PRODUCER = {
  pass: "product-packet-compiler-v3",
  codeSha: "e4db8ae",
  toolVersions: { zod: "4.4.3" },
};

const GENERATED_SCREEN_PATH = "src/screens/PlayPage.tsx";
const GENERATED_SCREEN_HASH = sha("generated-play-page");

function semanticEnvelope(artifactType: string, payload: unknown) {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer: PRODUCER,
    payload,
  });
}

function envelopeHash(artifactType: string, payload: unknown): string {
  return hashCanonicalJson(semanticEnvelope(artifactType, payload));
}

function strictStitchProductSpec() {
  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("unreachable");
  const productSpec: any = structuredClone(compiled.productSpec);
  const action = productSpec.actions[0]!;
  action.input.fields = [{ name: "phase", valueType: "string", required: true }];
  action.evidenceScenario.targetInputValues = { phase: "playing" };
  action.stateDeltas[0]!.valueFrom = { kind: "input", field: "phase" };

  const optionalEvidence = {
    id: "EVID_OPTIONAL_FAILURE",
    kind: "state_transition",
    required: false,
    subjectRef: "STATE_GAME_PHASE",
    capabilityRefs: ["CAP_BROWSER_INTERACTION"],
    assertion: { operator: "not_equals", expected: { phase: "playing" } },
  };
  action.failure.evidenceRefs = [optionalEvidence.id];
  action.evidenceRefs = [...action.evidenceRefs, optionalEvidence.id].sort();
  productSpec.evidencePredicates.push(optionalEvidence);
  productSpec.traceability.bindings.push({
    semanticKind: "evidence",
    semanticRef: optionalEvidence.id,
    requirementRefs: productSpec.requirements.map((requirement: any) => requirement.id).sort(),
  });
  return ProductSpecV2Schema.parse(productSpec);
}

async function exactDesignFixture() {
  const productSpec = strictStitchProductSpec();
  const targetsResult = produceDesignGenerationTargetsV2(productSpec);
  assert.equal(targetsResult.status, "produced", JSON.stringify(targetsResult));
  if (targetsResult.status !== "produced") throw new Error("unreachable");
  const generationTargets = targetsResult.generationTargets;
  const target = generationTargets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const accessibilityObservable = target.requiredObservableSelectors.find((observable) =>
    observable.selector.kind === "accessibility")!;
  assert.equal(accessibilityObservable.selector.kind, "accessibility");
  if (accessibilityObservable.selector.kind !== "accessibility") throw new Error("unreachable");
  const statusSurface = accessibilityObservable.selector.surfaceRef;
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) => surfaceRef !== statusSurface)!;
  const actionInputRef = `${placement.actionRef}.${placement.inputFields[0]}`;
  const htmlBytes = validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}">`,
    `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}" data-action-input="${actionInputRef}">Start Game</button>`,
    `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
    `<section data-surface-id="${statusSurface}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
    "</main>",
  ].join(""), "implementation-slice-v2");
  const screenshotBytes = validStitchPng(241);
  const screenId = "screen-implementation-slice-v2";
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2" as const,
    projectId: "implementation-slice-v2-test",
    batches: [{
      stageId: "stage-implementation-slice-v2",
      targetRefs: [target.targetId],
      source: "direct" as const,
      candidates: [{
        screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens.screen-implementation-slice-v2"],
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
  const renderedSemantics = rendered.artifact;
  const selected = selectStitchTargetCandidatesV2({
    generationTargets,
    directResponseEvidence,
    artifacts,
    renderedSemantics,
  });
  assert.equal(selected.status, "produced", JSON.stringify(selected));
  if (selected.status !== "produced") throw new Error("unreachable");
  const candidateSelection = selected.candidateSelection;
  const bound = bindStitchTargetCandidateSelectionsV3({
    generationTargets,
    candidateSelection,
    renderedSemantics,
  });
  assert.equal(bound.status, "produced", JSON.stringify(bound));
  if (bound.status !== "produced") throw new Error("unreachable");
  const responseBindings = bound.responseBindings;
  const graph = produceDesignInteractionGraphV2({
    productSpec,
    generationTargets,
    renderedSemantics,
    candidateSelection,
    responseBindings,
  }).designGraph;
  return {
    productSpec,
    generationTargets,
    directResponseEvidence,
    renderedSemantics,
    candidateSelection,
    responseBindings,
    graph,
  };
}

function stitchTopology(productSpec: ReturnType<typeof strictStitchProductSpec>) {
  const runtimeDataContract = {
    schema: "setfarm.runtime-data-contract.v1" as const,
    contractVersion: 1 as const,
    sourceProductSpecHash: hashCanonicalJson(productSpec),
    delivery: { platform: "game" as const, techStack: "browser-game" as const, database: "none" as const },
    policyBindings: [],
    authorities: [{
      id: "AUTH_DATA_STATELESS_NONE",
      kind: "stateless" as const,
      durability: "none" as const,
      persistenceRefs: [],
    }],
    writableVolumes: [],
    scratch: { kind: "none" as const },
  };
  const previewArgv = [
    "npm", "run", "preview", "--", "--host", "{{HOST}}", "--port", "{{PORT}}", "--strictPort",
  ];
  const runtimeEvidenceContract = {
    schema: "setfarm.runtime-evidence-contract.v1" as const,
    adapter: "browser-service" as const,
    stackPackId: "browser-game-canvas" as const,
    server: { argv: previewArgv, cwd: "." as const, timeoutMs: 120_000 },
    readiness: { method: "GET" as const, path: "/play", expectedStatus: 200, timeoutMs: 120_000 },
    capture: {
      schema: "setfarm.browser-state-capture.v1" as const,
      globalName: "__SETFARM_TEST_BRIDGE__",
      actionInvocation: { schema: "setfarm.browser-action-invocation.v1" as const, method: "invokeAction" },
      scenarioMode: {
        schema: "setfarm.browser-scenario-mode.v1" as const,
        globalName: "__SETFARM_SCENARIO_MODE__",
        value: "manual" as const,
      },
      stateBindings: productSpec.states
        .map((state) => ({ stateRef: state.id, pointer: `/states/${state.id}` }))
        .sort((left, right) => left.stateRef.localeCompare(right.stateRef)),
    },
    flowIsolation: {
      schema: "setfarm.browser-flow-isolation.v1" as const,
      method: "clear-local-session-storage-and-reload" as const,
    },
  };
  return BuildTopologyV1Schema.parse({
    schema: "setfarm.build-topology.v1",
    stackPack: { id: "browser-game-canvas", version: "2.0.0", contentHash: sha("stack") },
    repo: { id: "implementation-slice-v2", baseSha: "1".repeat(40), treeHash: "2".repeat(40) },
    owners: [
      { id: "OWNER_SETUP", kind: "setup" },
      { id: "OWNER_US_001", kind: "story", storyRef: "US-001" },
    ],
    pathBindings: [
      {
        id: "PATH_APP",
        path: "src/App.tsx",
        role: "entrypoint",
        ownerRef: "OWNER_US_001",
        presence: "present",
        knownContentHash: sha("app-v1"),
      },
      {
        id: "PATH_PLAY_PAGE",
        path: GENERATED_SCREEN_PATH,
        role: "generated",
        ownerRef: "OWNER_US_001",
        presence: "present",
        knownContentHash: GENERATED_SCREEN_HASH,
      },
      {
        id: "PATH_SHARED_READ",
        path: "src/shared/read.ts",
        role: "source",
        ownerRef: "OWNER_SETUP",
        presence: "present",
        knownContentHash: sha("shared-read-v1"),
      },
      {
        id: "PATH_SHARED_WRITE",
        path: "src/shared/write.ts",
        role: "source",
        ownerRef: "OWNER_SETUP",
        presence: "present",
        knownContentHash: sha("shared-write-v1"),
      },
    ],
    sharedGrants: [
      {
        id: "GRANT_SETUP_READ",
        fromOwnerRef: "OWNER_SETUP",
        toOwnerRef: "OWNER_US_001",
        pathRefs: ["PATH_SHARED_READ"],
        permissions: ["read"],
      },
      {
        id: "GRANT_SETUP_WRITE",
        fromOwnerRef: "OWNER_SETUP",
        toOwnerRef: "OWNER_US_001",
        pathRefs: ["PATH_SHARED_WRITE"],
        permissions: ["read", "write"],
      },
    ],
    entrypoints: [{
      id: "ENTRY_GAME",
      kind: "game",
      pathRef: "PATH_APP",
      mountPoint: "/",
      routeRefs: productSpec.routes.map((route) => route.id).sort(),
    }],
    commands: [
      {
        id: "CMD_BUILD",
        kind: "build",
        argv: ["npm", "run", "build"],
        cwd: ".",
        timeoutMs: 120_000,
        capabilityRefs: [],
      },
      {
        id: "CMD_PREVIEW",
        kind: "preview",
        argv: previewArgv,
        cwd: ".",
        timeoutMs: 120_000,
        capabilityRefs: ["CAP_BROWSER_INTERACTION"],
      },
    ],
    capabilities: [
      { id: "CAP_BROWSER_INTERACTION", kind: "browser_interaction", enabled: true },
      { id: "CAP_LOCAL_PERSISTENCE", kind: "local_persistence", enabled: true },
    ],
    policies: {
      packageManager: "npm",
      allowedRoots: ["src"],
      deniedGlobs: [".env*"],
      buildOutputPaths: ["dist"],
    },
    runtimeDataContract,
    runtimeDataContractHash: hashRuntimeDataContractV1(runtimeDataContract),
    runtimeEvidenceContract,
    runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtimeEvidenceContract),
  });
}

function stitchClosure(value: Awaited<ReturnType<typeof exactDesignFixture>>) {
  const typedRef = (artifactType: string, payload: unknown) => ({
    artifactType,
    envelopeHash: envelopeHash(artifactType, payload),
    payloadHash: hashCanonicalJson(payload),
  });
  return DesignSourceClosureV2Schema.parse({
    schema: "setfarm.design-source-closure.v2",
    kind: "stitch",
    generationTargets: typedRef("setfarm.design-generation-targets.v2", value.generationTargets),
    directResponseEvidence: typedRef(
      "setfarm.stitch-direct-response-evidence.v2",
      value.directResponseEvidence,
    ),
    renderedSemantics: typedRef(
      "setfarm.stitch-rendered-semantics.v2",
      value.renderedSemantics,
    ),
    candidateSelection: typedRef(
      "setfarm.stitch-target-candidate-selection.v2",
      value.candidateSelection,
    ),
    responseBindings: typedRef(
      "setfarm.stitch-target-response-bindings.v3",
      value.responseBindings,
    ),
    designGraph: typedRef("setfarm.design-interaction-graph.v2", value.graph),
    acceptedAttempt: {
      attemptRef: `PCA_${sha("accepted-attempt")}`,
      outputSealHash: sha("accepted-output-seal"),
    },
    artifactManifest: {
      artifactType: "setfarm.product-compilation-artifact-manifest.v1",
      artifactHash: sha("artifact-manifest"),
    },
    projectionReceipt: {
      artifactType: "setfarm.product-compilation-projection-receipt.v1",
      artifactHash: sha("projection-receipt"),
    },
  });
}

function stitchImplementationSourceMap(input: Readonly<{
  design: Awaited<ReturnType<typeof exactDesignFixture>>;
  buildTopology: ReturnType<typeof stitchTopology>;
  storyPlan: ReturnType<typeof produceStoryPlanV2> extends { status: "produced"; storyPlan: infer T } ? T : never;
  designSourceClosure: ReturnType<typeof stitchClosure>;
}>) {
  const target = input.design.generationTargets.targets[0]!;
  const response = input.design.responseBindings.bindings[0]!;
  const story = input.storyPlan.stories[0]!;
  const controls = input.design.graph.controls
    .filter((control) => control.source.targetRef === target.targetId)
    .sort((left, right) => left.identity.controlSlotRef.localeCompare(right.identity.controlSlotRef));
  const localIdByControl = new Map(controls.map((control, index) =>
    [control.id, `generated-control-${index + 1}`] as const));
  const mappedControls = controls.map((control) => {
    const action = input.design.productSpec.actions.find((candidate) =>
      candidate.id === control.identity.actionRef)!;
    const placement = action.controlPlacements.find((candidate) =>
      candidate.id === control.identity.controlSlotRef)!;
    const generatedLocalId = localIdByControl.get(control.id)!;
    const generatedKind = control.nativeControlKind ?? (control.role === "link" ? "link" : "button");
    return {
      controlSlotRef: control.identity.controlSlotRef,
      actionRef: action.id,
      placement,
      controlPlacementHash: hashCanonicalJson(placement),
      affectedSurfaceRefs: [...action.affectedSurfaceRefs].sort(),
      physicalControlRef: control.id,
      sourceElementRef: control.elementRef,
      sourceElementHash: control.elementHash,
      generatedLocalId,
      generatedSelector: `[data-action-id="${generatedLocalId}"]`,
      generatedKind,
      tagName: control.tagName,
      nativeControlKind: control.nativeControlKind,
      role: control.role,
      ariaLabel: control.ariaLabel,
      href: control.href,
      interactiveRole: control.interactiveRole,
      handlerBinding: {
        actionsPropName: "actions" as const,
        callbackKey: generatedLocalId,
        event: generatedKind === "button" || generatedKind === "link" ? "click" as const : "change" as const,
        preventsDefault: control.tagName === "a",
        inputFields: action.input.fields.map((field) => field.name).sort(),
      },
    };
  });
  const actionInputs = controls.flatMap((control) => {
    const generatedControlId = localIdByControl.get(control.id)!;
    return control.actionInputBindings.map((binding) => {
      const actionRef = control.identity.actionRef;
      const actionInputRef = `${actionRef}.${binding.fieldRef}`;
      return {
        actionInputRef,
        actionRef,
        inputField: binding.fieldRef,
        sourceElementRef: binding.elementRef,
        sourceElementHash: binding.elementHash,
        generatedControlId,
        generatedSelector: `[data-action-id="${generatedControlId}"]`,
        stateKey: actionInputRef,
        valueEvent: "change" as const,
        actionHandlerIds: mappedControls
          .filter((candidate) => candidate.actionRef === actionRef)
          .map((candidate) => candidate.generatedLocalId)
          .sort(),
      };
    });
  }).sort((left, right) =>
    `${left.actionInputRef}\0${left.generatedControlId}`.localeCompare(
      `${right.actionInputRef}\0${right.generatedControlId}`,
    ));
  const observables = input.design.graph.observables
    .filter((observable) => observable.source.targetRef === target.targetId)
    .sort((left, right) => left.observableRef.localeCompare(right.observableRef))
    .map((observable) => ({
      observableRef: observable.observableRef,
      actionRef: observable.actionRef,
      selector: observable.selector,
      selectorHash: observable.selectorHash,
      evidenceRef: observable.evidenceRef,
      sourceElementRef: observable.elementBindings[0]!.elementRef,
      sourceElementHash: observable.elementBindings[0]!.elementHash,
      generatedSelector: `[data-observable-refs~="${observable.observableRef}"]`,
      assertionsHash: observable.assertionsHash,
    }));
  const graphSurfaceByRef = new Map(input.design.graph.surfaces.map((surface) =>
    [surface.surfaceRef, surface] as const));
  const surfaceSource = (surfaceRef: string) => {
    const surface = graphSurfaceByRef.get(surfaceRef)!;
    return {
      surfaceRef,
      sourceElementRef: surface.elementRef,
      sourceElementHash: surface.elementHash,
    };
  };
  const counts = { buttons: 0, links: 0, inputs: 0, textareas: 0, selects: 0 };
  mappedControls.forEach((control) => {
    if (control.generatedKind === "button") counts.buttons += 1;
    else if (control.generatedKind === "link") counts.links += 1;
    else if (control.generatedKind === "input") counts.inputs += 1;
    else if (control.generatedKind === "textarea") counts.textareas += 1;
    else counts.selects += 1;
  });
  return ImplementationSourceMapV1Schema.parse({
    schema: "setfarm.implementation-source-map.v1",
    sourceMapVersion: 1,
    designSourceKind: "stitch",
    productSpecV2PayloadHash: hashCanonicalJson(input.design.productSpec),
    designGraphV2PayloadHash: hashCanonicalJson(input.design.graph),
    buildTopologyV1PayloadHash: hashCanonicalJson(input.buildTopology),
    storyPlanV2PayloadHash: hashCanonicalJson(input.storyPlan),
    designSourceClosureV2PayloadHash: hashCanonicalJson(input.designSourceClosure),
    screenIndexV2PayloadHash: sha("screen-index-payload"),
    screenIndexSourceHash: sha("screen-index-source"),
    converter: {
      schema: "setfarm.implementation-source-converter.v1",
      converterId: "setfarm.stitch-to-jsx",
      contractVersion: 1,
      componentApiSchema: "setfarm.generated-screen-component-api.v1",
      sourceHash: sha("stitch-converter-source"),
      sourceByteLength: 1_024,
    },
    screens: [{
      targetRef: target.targetId,
      responseScreenId: response.responseScreenId,
      routeRef: target.routeRef,
      rootSurface: surfaceSource(target.surfaceRef),
      containedSurfaces: [...target.containedSurfaceRefs].sort().map(surfaceSource),
      pathRef: "PATH_PLAY_PAGE",
      path: GENERATED_SCREEN_PATH,
      contentHash: GENERATED_SCREEN_HASH,
      sourceByteLength: 2_048,
      componentName: "PlayPage",
      componentApi: {
        schema: "setfarm.generated-screen-component-api.v1",
        actionsPropName: "actions",
        actionBindings: mappedControls.map((control) => ({
          generatedLocalId: control.generatedLocalId,
          actionRef: control.actionRef,
          inputFields: control.handlerBinding.inputFields,
        })).sort((left, right) =>
          `${left.generatedLocalId}\0${left.actionRef}`.localeCompare(
            `${right.generatedLocalId}\0${right.actionRef}`,
          )),
        inputTransports: actionInputs.map((transport) => ({
          actionInputRef: transport.actionInputRef,
          generatedControlId: transport.generatedControlId,
          stateKey: transport.stateKey,
        })),
      },
      targetHash: hashCanonicalJson(target),
      responseBindingHash: hashCanonicalJson(response),
      storyId: story.id,
      ownerRef: story.ownerRef,
      controls: mappedControls,
      actionInputs,
      observables,
      rejectedControls: [],
      cardinality: { raw: counts, accepted: counts, rejected: {
        buttons: 0, links: 0, inputs: 0, textareas: 0, selects: 0,
      } },
    }],
  });
}

function noDesignImplementationSourceMap(input: Readonly<{
  productSpec: unknown;
  buildTopology: unknown;
  storyPlan: unknown;
  designSourceClosure: unknown;
}>) {
  return ImplementationSourceMapV1Schema.parse({
    schema: "setfarm.implementation-source-map.v1",
    sourceMapVersion: 1,
    designSourceKind: "none",
    productSpecV2PayloadHash: hashCanonicalJson(input.productSpec),
    designGraphV2PayloadHash: null,
    buildTopologyV1PayloadHash: hashCanonicalJson(input.buildTopology),
    storyPlanV2PayloadHash: hashCanonicalJson(input.storyPlan),
    designSourceClosureV2PayloadHash: hashCanonicalJson(input.designSourceClosure),
    screenIndexV2PayloadHash: null,
    screenIndexSourceHash: null,
    converter: null,
    screens: [],
  });
}

async function stitchCompilerFixture() {
  const design = await exactDesignFixture();
  const buildTopology = stitchTopology(design.productSpec);
  const storyPlanResult = produceStoryPlanV2({
    productSpec: design.productSpec,
    designGraph: design.graph,
    buildTopology,
  });
  assert.equal(storyPlanResult.status, "produced", JSON.stringify(storyPlanResult));
  if (storyPlanResult.status !== "produced") throw new Error("unreachable");
  const storyPlan = storyPlanResult.storyPlan;
  const designSourceClosure = stitchClosure(design);
  const implementationSourceMap = stitchImplementationSourceMap({
    design,
    buildTopology,
    storyPlan,
    designSourceClosure,
  });
  const packet = ProductBuildPacketV3Schema.parse({
    schema: "setfarm.product-build-packet.v3",
    packetVersion: 3,
    parentPacketHashes: [],
    designSourceKind: "stitch",
    productSpecV2Hash: envelopeHash("setfarm.product-spec.v2", design.productSpec),
    designGraphV2Hash: envelopeHash("setfarm.design-interaction-graph.v2", design.graph),
    buildTopologyV1Hash: envelopeHash("setfarm.build-topology.v1", buildTopology),
    storyPlanV2Hash: envelopeHash("setfarm.story-plan.v2", storyPlan),
    runtimeDataContractHash: buildTopology.runtimeDataContractHash,
    runtimeEvidenceContractHash: buildTopology.runtimeEvidenceContractHash,
    designSourceClosureV2Hash: envelopeHash("setfarm.design-source-closure.v2", designSourceClosure),
    implementationSourceMapV1Hash: envelopeHash(
      "setfarm.implementation-source-map.v1",
      implementationSourceMap,
    ),
    compiler: { version: "4.0.0", codeSha: "e4db8ae" },
    validationIds: ["VALIDATE_IMPLEMENTATION_SLICE_V2"],
  });
  const story = storyPlan.stories[0]!;
  const accessiblePathRefs = new Set([
    ...story.ownedPathRefs,
    ...buildTopology.sharedGrants
      .filter((grant) => story.sharedGrantRefs.includes(grant.id))
      .flatMap((grant) => grant.pathRefs),
  ]);
  const sourceRevision = { sha: "3".repeat(40), treeHash: "4".repeat(40) };
  const input = {
    packetHash: envelopeHash("setfarm.product-build-packet.v3", packet),
    packet,
    productSpec: design.productSpec,
    designGraph: design.graph,
    buildTopology,
    storyPlan,
    designSourceClosure,
    implementationSourceMap,
    storyId: story.id,
    sourceRevision,
    producer: PRODUCER,
    currentFiles: buildTopology.pathBindings
      .filter((binding) => accessiblePathRefs.has(binding.id))
      .map((binding) => ({
        pathRef: binding.id,
        presence: binding.presence,
        contentHash: binding.knownContentHash,
      })),
    dependencyOutputs: [],
  };
  return {
    ...design,
    buildTopology,
    storyPlan,
    designSourceClosure,
    implementationSourceMap,
    packet,
    sourceRevision,
    input,
  };
}

function resealStitchCompilerInput(input: any): void {
  const productSpecPayloadHash = hashCanonicalJson(input.productSpec);
  input.designGraph.productSpecHash = productSpecPayloadHash;
  input.designGraph.actions.forEach((designAction: any) => {
    const productAction = input.productSpec.actions.find((action: any) =>
      action.id === designAction.actionRef)!;
    designAction.productActionHash = hashCanonicalJson(productAction);
  });
  if (input.buildTopology.runtimeDataContract) {
    input.buildTopology.runtimeDataContract.sourceProductSpecHash = productSpecPayloadHash;
    input.buildTopology.runtimeDataContractHash = hashRuntimeDataContractV1(
      input.buildTopology.runtimeDataContract,
    );
  }
  const designGraphPayloadHash = hashCanonicalJson(input.designGraph);
  input.storyPlan.productSpecHash = productSpecPayloadHash;
  input.storyPlan.designGraphHash = designGraphPayloadHash;
  input.storyPlan.buildTopologyHash = hashCanonicalJson(input.buildTopology);
  input.designSourceClosure.designGraph.payloadHash = designGraphPayloadHash;
  input.designSourceClosure.designGraph.envelopeHash = envelopeHash(
    "setfarm.design-interaction-graph.v2",
    input.designGraph,
  );
  input.implementationSourceMap.productSpecV2PayloadHash = productSpecPayloadHash;
  input.implementationSourceMap.designGraphV2PayloadHash = designGraphPayloadHash;
  input.implementationSourceMap.buildTopologyV1PayloadHash = hashCanonicalJson(input.buildTopology);
  input.implementationSourceMap.storyPlanV2PayloadHash = hashCanonicalJson(input.storyPlan);
  input.implementationSourceMap.designSourceClosureV2PayloadHash = hashCanonicalJson(
    input.designSourceClosure,
  );
  input.packet.productSpecV2Hash = envelopeHash("setfarm.product-spec.v2", input.productSpec);
  input.packet.designGraphV2Hash = envelopeHash(
    "setfarm.design-interaction-graph.v2",
    input.designGraph,
  );
  input.packet.buildTopologyV1Hash = envelopeHash("setfarm.build-topology.v1", input.buildTopology);
  input.packet.storyPlanV2Hash = envelopeHash("setfarm.story-plan.v2", input.storyPlan);
  input.packet.runtimeDataContractHash = input.buildTopology.runtimeDataContractHash;
  input.packet.designSourceClosureV2Hash = envelopeHash(
    "setfarm.design-source-closure.v2",
    input.designSourceClosure,
  );
  input.packet.implementationSourceMapV1Hash = envelopeHash(
    "setfarm.implementation-source-map.v1",
    input.implementationSourceMap,
  );
  input.packetHash = envelopeHash("setfarm.product-build-packet.v3", input.packet);
}

function compileOrThrow(input: unknown) {
  const result = compileImplementationSliceV2(input);
  assert.equal(result.status, "compiled", JSON.stringify(result));
  if (result.status !== "compiled") throw new Error("unreachable");
  return result;
}

function rejectionCodes(input: unknown): string[] {
  const result = compileImplementationSliceV2(input);
  assert.equal(result.status, "rejected", JSON.stringify(result));
  return result.status === "rejected" ? result.diagnostics.map((item) => item.code) : [];
}

function twoComponentNoDesignProductSpec(
  settingsMode: "user-boolean" | "cli-required-date" = "user-boolean",
) {
  const productSpec: any = structuredClone(
    buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
  );
  const requirementRefs = productSpec.requirements.map((requirement: any) => requirement.id);
  const requiredDate = settingsMode === "cli-required-date";
  const actionRef = "ACT_TOGGLE_SETTINGS";
  const observableRef = "OBS_SETTINGS_UPDATED";
  const observableEvidenceRef = "EVID_SETTINGS_UPDATED";
  const invocationEvidenceRef = deriveActionInvocationEvidenceIdV2(actionRef);
  const field = requiredDate
    ? { name: "scheduledDate", valueType: "date", required: true }
    : { name: "enabled", valueType: "boolean", required: true };
  const evidenceValue = requiredDate ? "2026-07-17" : true;

  productSpec.states.push({
    id: "STATE_SETTINGS_MODE",
    name: "Settings Mode",
    kind: "application",
    initialValue: requiredDate ? { scheduledDate: null } : { enabled: false },
    invariants: [requiredDate
      ? "The scheduled date is an RFC 3339 full-date string after invocation."
      : "The enabled value is boolean."],
  });
  productSpec.routes.push({
    id: "ROUTE_SETTINGS",
    path: "/settings",
    rootSurfaceRef: "SURF_SETTINGS_TERMINAL",
    surfaceRefs: ["SURF_SETTINGS_TERMINAL"],
    entry: false,
  });
  productSpec.surfaces.push({
    id: "SURF_SETTINGS_TERMINAL",
    name: "Settings Terminal",
    kind: "terminal",
    routeRef: "ROUTE_SETTINGS",
    required: true,
    composition: { kind: "route_root" },
  });
  productSpec.actions.push({
    id: actionRef,
    name: "Toggle Settings",
    controlPlacements: [],
    affectedSurfaceRefs: ["SURF_SETTINGS_TERMINAL"],
    trigger: { kind: "user" },
    invocationInterface: {
      schema: "setfarm.action-invocation-interface-intent.v1",
      kind: "cli_command",
      subcommandTokens: ["settings", "set"],
      fieldBindings: [{
        fieldName: field.name,
        optionalPresence: "not_applicable",
        channel: {
          kind: "argv_flag",
          flag: requiredDate ? "--scheduled-date" : "--enabled",
          style: "separate",
        },
      }],
      result: {
        kind: "stdout_json",
        successExitCodes: [0],
        valuePointer: "/settings",
        failureCases: [
          {
            kind: "input_validation",
            exitCodes: [2],
            channel: "stderr_json",
            errorCode: "INPUT_VALIDATION_FAILED",
            codePointer: "/error/code",
            messagePointer: "/error/message",
          },
          {
            kind: "action_failure",
            exitCodes: [1],
            channel: "stderr_json",
            errorCode: "ACTION_FAILED",
            codePointer: "/error/code",
            messagePointer: "/error/message",
          },
        ],
      },
    },
    input: { fields: [field] },
    preconditions: [],
    evidenceScenario: {
      targetInputValues: { [field.name]: evidenceValue },
      prerequisiteSteps: [],
    },
    stateDeltas: [{
      stateRef: "STATE_SETTINGS_MODE",
      operation: "set",
      path: requiredDate ? "/scheduledDate" : "/enabled",
      valueFrom: { kind: "input", field: field.name },
    }],
    navigation: { kind: "stay" },
    persistenceEffects: [],
    success: {
      stateRefs: ["STATE_SETTINGS_MODE"],
      persistenceRefs: [],
      evidenceRefs: [observableEvidenceRef, invocationEvidenceRef],
      userVisible: true,
    },
    failure: {
      stateRefs: [],
      persistenceRefs: [],
      evidenceRefs: [],
      userVisible: true,
    },
    evidenceRefs: [observableEvidenceRef, invocationEvidenceRef],
    observableEffects: [{
      id: observableRef,
      selector: {
        kind: "invocation_output",
        coordinate: "result_value",
        pointer: requiredDate ? "/scheduledDate" : "/enabled",
        valueContract: {
          valueType: field.valueType,
          expectedFrom: { kind: "input", fieldName: field.name },
        },
      },
      assertions: [{ phase: "after", property: "value", operator: "equals", expected: evidenceValue }],
      evidenceRef: observableEvidenceRef,
    }],
  });
  productSpec.evidencePredicates.push(
    {
      id: observableEvidenceRef,
      kind: "observable_outcome",
      required: true,
      subjectRef: observableRef,
      capabilityRefs: ["CAP_CLI_INTERACTION"],
      assertion: { operator: "passes" },
    },
    {
      id: invocationEvidenceRef,
      kind: "action_invocation",
      required: true,
      subjectRef: actionRef,
      capabilityRefs: [],
      assertion: { operator: "passes" },
    },
  );
  productSpec.evidencePredicates.forEach((predicate: any) => {
    predicate.capabilityRefs = predicate.kind === "action_invocation"
      ? []
      : ["CAP_CLI_INTERACTION"];
  });
  for (const [semanticKind, semanticRef] of [
    ["state", "STATE_SETTINGS_MODE"],
    ["route", "ROUTE_SETTINGS"],
    ["surface", "SURF_SETTINGS_TERMINAL"],
    ["action", actionRef],
    ["evidence", observableEvidenceRef],
    ["evidence", invocationEvidenceRef],
    ["observable", observableRef],
  ] as const) {
    productSpec.traceability.bindings.push({ semanticKind, semanticRef, requirementRefs });
  }
  return ProductSpecV2Schema.parse(productSpec);
}

function dependencyCompilerFixture(
  settingsMode: "user-boolean" | "cli-required-date" = "user-boolean",
) {
  const productSpec = twoComponentNoDesignProductSpec(settingsMode);
  const buildTopology = BuildTopologyV1Schema.parse({
    schema: "setfarm.build-topology.v1",
    stackPack: { id: "node-cli", version: "2.0.0", contentHash: sha("node-cli-stack") },
    repo: { id: "slice-v2-dependency", baseSha: "5".repeat(40), treeHash: "6".repeat(40) },
    owners: [
      { id: "OWNER_US_001", kind: "story", storyRef: "US-001" },
      { id: "OWNER_US_002", kind: "story", storyRef: "US-002" },
    ],
    pathBindings: [
      {
        id: "PATH_APP",
        path: "src/app.ts",
        role: "source",
        ownerRef: "OWNER_US_001",
        presence: "present",
        knownContentHash: sha("dependency-app-base"),
      },
      {
        id: "PATH_SETTINGS",
        path: "src/settings.ts",
        role: "source",
        ownerRef: "OWNER_US_002",
        presence: "present",
        knownContentHash: sha("settings-base"),
      },
    ],
    sharedGrants: [{
      id: "GRANT_APP_TO_SETTINGS",
      fromOwnerRef: "OWNER_US_001",
      toOwnerRef: "OWNER_US_002",
      pathRefs: ["PATH_APP"],
      permissions: ["read"],
    }],
    entrypoints: [{
      id: "ENTRY_CLI",
      kind: "cli",
      pathRef: "PATH_APP",
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
    capabilities: [{ id: "CAP_CLI_INTERACTION", kind: "cli_interaction", enabled: true }],
    policies: { packageManager: "npm", allowedRoots: ["src"], deniedGlobs: [], buildOutputPaths: ["dist"] },
  });
  const storyPlanResult = produceStoryPlanV2({ productSpec, buildTopology });
  assert.equal(storyPlanResult.status, "produced", JSON.stringify(storyPlanResult));
  if (storyPlanResult.status !== "produced") throw new Error("unreachable");
  const storyPlan = storyPlanResult.storyPlan;
  const story = storyPlan.stories[1]!;
  assert.deepEqual(story.dependsOn, ["US-001"]);
  const designSourceClosure = DesignSourceClosureV2Schema.parse({
    schema: "setfarm.design-source-closure.v2",
    kind: "none",
    reason: "product_delivery_design_not_required",
  });
  const implementationSourceMap = noDesignImplementationSourceMap({
    productSpec,
    buildTopology,
    storyPlan,
    designSourceClosure,
  });
  const packet = ProductBuildPacketV3Schema.parse({
    schema: "setfarm.product-build-packet.v3",
    packetVersion: 3,
    parentPacketHashes: [],
    designSourceKind: "none",
    productSpecV2Hash: envelopeHash("setfarm.product-spec.v2", productSpec),
    designGraphV2Hash: null,
    buildTopologyV1Hash: envelopeHash("setfarm.build-topology.v1", buildTopology),
    storyPlanV2Hash: envelopeHash("setfarm.story-plan.v2", storyPlan),
    designSourceClosureV2Hash: envelopeHash("setfarm.design-source-closure.v2", designSourceClosure),
    implementationSourceMapV1Hash: envelopeHash(
      "setfarm.implementation-source-map.v1",
      implementationSourceMap,
    ),
    compiler: { version: "4.0.0", codeSha: "e4db8ae" },
    validationIds: ["VALIDATE_IMPLEMENTATION_SLICE_V2"],
  });
  const dependencyHash = sha("dependency-app-output");
  const dependencyOutput = {
    storyId: "US-001",
    sliceHash: sha("dependency-slice"),
    outputHash: sha("dependency-output"),
    sourceAfter: { sha: "7".repeat(40), treeHash: "8".repeat(40) },
    fileSignatures: [{
      pathRef: "PATH_APP",
      path: "src/app.ts",
      presence: "present" as const,
      contentHash: dependencyHash,
    }],
  };
  return {
    buildTopology,
    input: {
      packetHash: envelopeHash("setfarm.product-build-packet.v3", packet),
      packet,
      productSpec,
      designGraph: null,
      buildTopology,
      storyPlan,
      designSourceClosure,
      implementationSourceMap,
      storyId: story.id,
      sourceRevision: { sha: "9".repeat(40), treeHash: "a".repeat(40) },
      producer: PRODUCER,
      currentFiles: [
        { pathRef: "PATH_APP", presence: "present" as const, contentHash: dependencyHash },
        { pathRef: "PATH_SETTINGS", presence: "present" as const, contentHash: sha("settings-base") },
      ],
      dependencyOutputs: [dependencyOutput],
    },
  };
}

function recoveryDirective(input: any, options: Readonly<{
  pathRef: string;
  currentHash: string;
  afterHash: string;
  priorSliceHash: string;
}>) {
  const binding = input.buildTopology.pathBindings.find((candidate: any) => candidate.id === options.pathRef)!;
  const findingSet = createFindingSetV1({
    runId: "run-implementation-slice-v2",
    storyId: input.storyId,
    packetHash: input.packetHash,
    sliceHash: options.priorSliceHash,
    sourceRevision: input.sourceRevision,
    findings: [{
      origin: "review",
      classification: "structured",
      invariantRef: "INV_IMPLEMENTATION_BEHAVIOR",
      sourceLocators: [{ path: binding.path, contentHash: options.currentHash }],
      observedEvidenceRefs: [sha("observed-failure")],
      expectedPredicateRef: input.storyPlan.stories
        .find((story: any) => story.id === input.storyId)!.evidenceRefs[0],
      status: "open",
    }],
  });
  return {
    schema: "setfarm.implementation-recovery-directive.v2",
    findingSet,
    sourceRevision: input.sourceRevision,
    expectedSourceDelta: {
      schema: "setfarm.implementation-source-delta.v2",
      changes: [{
        pathRef: options.pathRef,
        path: binding.path,
        before: { presence: "present", contentHash: options.currentHash },
        after: { presence: "present", contentHash: options.afterHash },
      }],
    },
  };
}

describe("ImplementationSliceV2 exact authority compiler", { concurrency: 1 }, () => {
  it("compiles one deterministic Stitch story closure with exact controls, inputs, files, build, runtime, and source closure", async () => {
    const value = await stitchCompilerFixture();
    const reversed: any = structuredClone(value.input);
    reversed.currentFiles.reverse();
    const first = compileOrThrow(reversed);
    const second = compileOrThrow(structuredClone(value.input));

    assert.deepEqual(first.slice, second.slice);
    assert.equal(first.sliceHash, second.sliceHash);
    assert.deepEqual(first.envelope, semanticEnvelope("setfarm.implementation-slice.v2", first.slice));
    assert.equal(first.sliceHash, hashCanonicalJson(first.envelope));
    assert.notEqual(first.sliceHash, implementationSliceHashV2(first.slice));
    const mutableCandidate: any = structuredClone(first.slice);
    const verification = verifyImplementationSliceV2({
      compilerInput: value.input,
      slice: mutableCandidate,
    });
    assert.equal(verification.status, "verified");
    if (verification.status === "verified") {
      assert.deepEqual(verification.slice, first.slice);
      assert.equal(verification.sliceHash, first.sliceHash);
      assert.notStrictEqual(verification.slice, mutableCandidate);
      mutableCandidate.story.title = "mutated after verification";
      assert.notEqual(verification.slice.story.title, mutableCandidate.story.title);
    }
    assert.deepEqual(first.slice.files.map((file) => [file.pathRef, file.role]), [
      ["PATH_APP", "owned"],
      ["PATH_PLAY_PAGE", "owned"],
      ["PATH_SHARED_READ", "shared_readonly"],
      ["PATH_SHARED_WRITE", "shared_writable"],
    ]);
    assert.deepEqual(first.slice.sharedGrants.map((grant) => grant.id), [
      "GRANT_SETUP_READ",
      "GRANT_SETUP_WRITE",
    ]);
    assert.equal(first.slice.contract.product.actions[0]!.input.fields[0]!.name, "phase");
    assert.equal(first.slice.contract.product.evidencePredicates.some((item) =>
      item.id === "EVID_OPTIONAL_FAILURE" && !item.required), true);
    assert.equal(first.slice.story.evidenceRefs.includes("EVID_OPTIONAL_FAILURE"), false);
    assert.equal(first.slice.contract.design?.controls.length, 1);
    assert.deepEqual(first.slice.contract.design?.controls[0]!.actionInputBindings.map((binding) =>
      [binding.actionInputRef, binding.fieldRef]), [["ACT_START_GAME.phase", "phase"]]);
    assert.equal(first.slice.build.commands.some((command) => command.kind === "preview"), true);
    assert.deepEqual(first.slice.build.runtimeDataContract, value.buildTopology.runtimeDataContract);
    assert.deepEqual(first.slice.build.runtimeEvidenceContract, value.buildTopology.runtimeEvidenceContract);
    assert.equal(first.slice.designSourceClosure.kind, "stitch");
    assert.equal(first.slice.storySourceMap.designSourceKind, "stitch");
    assert.deepEqual(first.slice.storySourceMap.producer, PRODUCER);
    assert.deepEqual(
      first.slice.storySourceMap.implementationSourceMapV1Witness,
      value.implementationSourceMap,
    );
    assert.deepEqual(first.slice.storySourceMap.screens, value.implementationSourceMap.screens);
    assert.deepEqual(first.slice.actionInputTransports.map((transport) => [
      transport.actionInputRef,
      transport.valueType,
      transport.codecId,
    ]), [["ACT_START_GAME.phase", "string", "text.v2"]]);
    assert.equal(
      first.slice.authority.actionInputTransportsHash,
      implementationActionInputTransportsHashV2(first.slice.actionInputTransports),
    );
    assert.equal(
      first.slice.authority.implementationSourceMapV1PayloadHash,
      hashCanonicalJson(value.implementationSourceMap),
    );
    assert.equal(
      first.slice.authority.implementationSourceMapV1Hash,
      value.packet.implementationSourceMapV1Hash,
    );
    assert.equal(
      first.slice.authority.storySourceMapHash,
      implementationStorySourceMapHashV1(first.slice.storySourceMap),
    );
    assert.equal(
      first.slice.designSourceClosure.kind === "stitch"
        ? first.slice.designSourceClosure.acceptedAttempt.outputSealHash
        : null,
      sha("accepted-output-seal"),
    );
  });

  it("rejects every v1 authority shape and permits a null graph only for a coherent no-design packet", async () => {
    const value = await stitchCompilerFixture();
    for (const [field, legacy] of [
      ["packet", { schema: "setfarm.product-build-packet.v1" }],
      ["productSpec", { schema: "setfarm.product-spec.v1" }],
      ["designGraph", { schema: "setfarm.design-interaction-graph.v1" }],
      ["storyPlan", { schema: "setfarm.story-plan.v1" }],
    ] as const) {
      const input: any = structuredClone(value.input);
      input[field] = legacy;
      assert.deepEqual([...new Set(rejectionCodes(input))], ["SLICE_V2_INPUT_INVALID"]);
    }
    const missingGraph: any = structuredClone(value.input);
    missingGraph.designGraph = null;
    const missingGraphCodes = rejectionCodes(missingGraph);
    assert.equal(missingGraphCodes.includes("SLICE_V2_DESIGN_AUTHORITY_MISMATCH"), true);

    const noDesign = dependencyCompilerFixture();
    const compiled = compileOrThrow(noDesign.input);
    assert.equal(compiled.slice.packet.designSourceKind, "none");
    assert.equal(compiled.slice.contract.design, null);
    assert.equal(compiled.slice.designSourceClosure.kind, "none");
    assert.equal(compiled.slice.storySourceMap.designSourceKind, "none");
    assert.deepEqual(compiled.slice.storySourceMap.screens, []);
    assert.deepEqual(compiled.slice.actionInputTransports, []);

    const noControl = dependencyCompilerFixture("cli-required-date");
    const noControlCompiled = compileOrThrow(noControl.input);
    const noControlAction = noControlCompiled.slice.contract.product.actions.find((action) =>
      action.id === "ACT_TOGGLE_SETTINGS")!;
    assert.equal(noControlAction.trigger.kind, "user");
    assert.equal(noControlAction.invocationInterface.kind, "cli_command");
    assert.deepEqual(noControlAction.controlPlacements, []);
    assert.deepEqual(noControlAction.input.fields, [{
      name: "scheduledDate",
      valueType: "date",
      required: true,
    }]);
    assert.deepEqual(noControlCompiled.slice.actionInputTransports, []);
  });

  it("keeps CAS envelope identities distinct from payload fingerprints", async () => {
    const value = await stitchCompilerFixture();
    const compiled = compileOrThrow(value.input);
    assert.equal(
      compiled.slice.authority.productSpecV2PayloadHash,
      hashCanonicalJson(value.productSpec),
    );
    assert.equal(compiled.slice.authority.productSpecV2Hash, value.packet.productSpecV2Hash);
    assert.notEqual(
      compiled.slice.authority.productSpecV2PayloadHash,
      compiled.slice.authority.productSpecV2Hash,
    );

    const payloadAsArtifact: any = structuredClone(value.input);
    payloadAsArtifact.packet.productSpecV2Hash = hashCanonicalJson(payloadAsArtifact.productSpec);
    payloadAsArtifact.packetHash = envelopeHash(
      "setfarm.product-build-packet.v3",
      payloadAsArtifact.packet,
    );
    assert.equal(rejectionCodes(payloadAsArtifact).includes("SLICE_V2_CHILD_HASH_MISMATCH"), true);

    const wrongProducer: any = structuredClone(value.input);
    wrongProducer.producer.pass = "forged-producer";
    assert.equal(rejectionCodes(wrongProducer).includes("SLICE_V2_PACKET_HASH_MISMATCH"), true);
  });

  it("rejects rendered input/profile incompatibility before story transport compilation", async () => {
    const value = await stitchCompilerFixture();

    const ambiguous: any = structuredClone(value.input);
    ambiguous.productSpec.actions[0]!.input.fields[0]!.required = false;
    resealStitchCompilerInput(ambiguous);
    assert.equal(
      rejectionCodes(ambiguous).includes("SLICE_V2_INPUT_INVALID"),
      true,
    );

    const unsupported: any = structuredClone(value.input);
    unsupported.productSpec.actions[0]!.input.fields[0]!.valueType = "date";
    unsupported.productSpec.actions[0]!.evidenceScenario.targetInputValues.phase = "2026-07-17";
    resealStitchCompilerInput(unsupported);
    assert.equal(
      rejectionCodes(unsupported).includes("SLICE_V2_INPUT_INVALID"),
      true,
    );
  });

  it("requires the exact source-map authority and rejects foreign maps or forged story projections", async () => {
    const value = await stitchCompilerFixture();

    const missing: any = structuredClone(value.input);
    delete missing.implementationSourceMap;
    assert.deepEqual([...new Set(rejectionCodes(missing))], ["SLICE_V2_INPUT_INVALID"]);

    const tampered: any = structuredClone(value.input);
    tampered.implementationSourceMap.productSpecV2PayloadHash = sha("foreign-product-payload");
    tampered.packet.implementationSourceMapV1Hash = envelopeHash(
      "setfarm.implementation-source-map.v1",
      tampered.implementationSourceMap,
    );
    tampered.packetHash = envelopeHash("setfarm.product-build-packet.v3", tampered.packet);
    assert.equal(
      rejectionCodes(tampered).includes("SLICE_V2_IMPLEMENTATION_SOURCE_MAP_AUTHORITY_MISMATCH"),
      true,
    );

    const forgedTargetHash: any = structuredClone(value.input);
    forgedTargetHash.implementationSourceMap.screens[0]!.targetHash = sha("foreign-target");
    forgedTargetHash.packet.implementationSourceMapV1Hash = envelopeHash(
      "setfarm.implementation-source-map.v1",
      forgedTargetHash.implementationSourceMap,
    );
    forgedTargetHash.packetHash = envelopeHash(
      "setfarm.product-build-packet.v3",
      forgedTargetHash.packet,
    );
    assert.equal(
      rejectionCodes(forgedTargetHash).includes(
        "SLICE_V2_IMPLEMENTATION_SOURCE_MAP_AUTHORITY_MISMATCH",
      ),
      true,
    );

    const foreign: any = structuredClone(value.input);
    foreign.implementationSourceMap.screens[0]!.storyId = "US-999";
    foreign.packet.implementationSourceMapV1Hash = envelopeHash(
      "setfarm.implementation-source-map.v1",
      foreign.implementationSourceMap,
    );
    foreign.packetHash = envelopeHash("setfarm.product-build-packet.v3", foreign.packet);
    assert.equal(
      rejectionCodes(foreign).includes("SLICE_V2_IMPLEMENTATION_SOURCE_MAP_AUTHORITY_MISMATCH"),
      true,
    );

    const reassignedTarget: any = structuredClone(value.input);
    reassignedTarget.implementationSourceMap.screens[0]!.targetRef = "TARGET_FORGED";
    reassignedTarget.packet.implementationSourceMapV1Hash = envelopeHash(
      "setfarm.implementation-source-map.v1",
      reassignedTarget.implementationSourceMap,
    );
    reassignedTarget.packetHash = envelopeHash(
      "setfarm.product-build-packet.v3",
      reassignedTarget.packet,
    );
    assert.equal(
      rejectionCodes(reassignedTarget).includes(
        "SLICE_V2_IMPLEMENTATION_SOURCE_MAP_AUTHORITY_MISMATCH",
      ),
      true,
    );

    const missingMappedFile: any = structuredClone(value.input);
    missingMappedFile.currentFiles = missingMappedFile.currentFiles.filter(
      (file: any) => file.pathRef !== "PATH_PLAY_PAGE",
    );
    const missingMappedFileCodes = rejectionCodes(missingMappedFile);
    assert.equal(missingMappedFileCodes.includes("SLICE_V2_FILE_SNAPSHOT_INVALID"), true);
    assert.equal(missingMappedFileCodes.includes("SLICE_V2_STORY_SOURCE_MAP_INVALID"), true);

    const compiled = compileOrThrow(value.input);
    const forgedSlice: any = structuredClone(compiled.slice);
    forgedSlice.storySourceMap.screens[0]!.storyId = "US-999";
    forgedSlice.authority.storySourceMapHash = hashCanonicalJson(forgedSlice.storySourceMap);
    forgedSlice.authorityHash = implementationSliceAuthorityHashV2(forgedSlice.authority);
    assert.equal(ImplementationSliceV2Schema.safeParse(forgedSlice).success, false);

    const projectionTamperCases: ReadonlyArray<readonly [string, (screen: any) => void]> = [
      ["componentName", (screen) => {
        screen.componentName = "ForgedPlayPage";
      }],
      ["componentApi", (screen) => {
        const control = screen.controls[0]!;
        const priorId = control.generatedLocalId;
        const forgedId = "generated-control-forged";
        control.generatedLocalId = forgedId;
        control.handlerBinding.callbackKey = forgedId;
        screen.componentApi.actionBindings.find((binding: any) =>
          binding.generatedLocalId === priorId)!.generatedLocalId = forgedId;
        screen.componentApi.inputTransports
          .filter((transport: any) => transport.generatedControlId === priorId)
          .forEach((transport: any) => {
            transport.generatedControlId = forgedId;
          });
        screen.actionInputs
          .filter((input: any) => input.generatedControlId === priorId)
          .forEach((input: any) => {
            input.generatedControlId = forgedId;
            input.actionHandlerIds = input.actionHandlerIds
              .map((handlerId: string) => handlerId === priorId ? forgedId : handlerId)
              .sort();
          });
      }],
      ["selector", (screen) => {
        screen.controls[0]!.generatedSelector = "[data-action-id=\"forged\"]";
      }],
      ["responseBindingHash", (screen) => {
        screen.responseBindingHash = sha("forged-response-binding");
      }],
      ["cardinality", (screen) => {
        screen.cardinality.raw.buttons += 1;
        screen.cardinality.rejected.buttons += 1;
      }],
    ];
    for (const [label, mutate] of projectionTamperCases) {
      const forgedProjection: any = structuredClone(compiled.slice);
      mutate(forgedProjection.storySourceMap.screens[0]!);
      assert.equal(
        ImplementationSourceMapV1Schema.safeParse({
          ...forgedProjection.storySourceMap.implementationSourceMapV1Witness,
          screens: forgedProjection.storySourceMap.screens,
        }).success,
        true,
        `${label} tamper must remain a strict V1 screen so witness equality is the rejecting invariant`,
      );
      forgedProjection.authority.storySourceMapHash = hashCanonicalJson(
        forgedProjection.storySourceMap,
      );
      forgedProjection.authorityHash = implementationSliceAuthorityHashV2(
        forgedProjection.authority,
      );
      assert.equal(
        ImplementationSliceV2Schema.safeParse(forgedProjection).success,
        false,
        `${label} projection tamper must not survive full local re-hashing`,
      );
    }

    const missingTypedTransport: any = structuredClone(compiled.slice);
    missingTypedTransport.actionInputTransports = [];
    missingTypedTransport.authority.actionInputTransportsHash =
      implementationActionInputTransportsHashV2([]);
    missingTypedTransport.authorityHash = implementationSliceAuthorityHashV2(
      missingTypedTransport.authority,
    );
    assert.equal(
      ImplementationSliceV2Schema.safeParse(missingTypedTransport).success,
      false,
      "A fully re-hashed slice cannot omit a required typed action-input transport",
    );
  });

  it("rejects fully re-hashed file, build, or story forgeries against authoritative compiler input", async () => {
    const value = await stitchCompilerFixture();
    const compiled = compileOrThrow(value.input);
    const invalidCandidate: any = structuredClone(compiled.slice);
    delete invalidCandidate.storySourceMap;
    const invalidVerification = verifyImplementationSliceV2({
      compilerInput: value.input,
      slice: invalidCandidate,
    });
    assert.equal(invalidVerification.status, "rejected");
    if (invalidVerification.status === "rejected") {
      assert.deepEqual(
        [...new Set(invalidVerification.diagnostics.map((item) => item.code))],
        ["SLICE_V2_CONTRACT_INVALID"],
      );
    }

    const forgeryCases: ReadonlyArray<readonly [string, (slice: any) => void]> = [
      ["file topology", (slice) => {
        const file = slice.files.find((candidate: any) => candidate.pathRef === "PATH_APP")!;
        file.path = "src/ForgedApp.tsx";
        file.contentHash = sha("forged-app");
        slice.authority.filesHash = implementationFilesHashV2(slice.files);
      }],
      ["build authority", (slice) => {
        slice.build.repo.treeHash = "f".repeat(40);
        slice.authority.buildAuthorityHash = hashCanonicalJson(slice.build);
      }],
      ["story authority", (slice) => {
        slice.story.title = `${slice.story.title} forged`;
        slice.authority.storyHash = hashCanonicalJson(slice.story);
      }],
    ];

    for (const [label, mutate] of forgeryCases) {
      const forged: any = structuredClone(compiled.slice);
      mutate(forged);
      forged.authorityHash = implementationSliceAuthorityHashV2(forged.authority);
      assert.equal(
        ImplementationSliceV2Schema.safeParse(forged).success,
        true,
        `${label} remains internally self-consistent after local re-hashing`,
      );
      const verification = verifyImplementationSliceV2({
        compilerInput: value.input,
        slice: forged,
      });
      assert.equal(verification.status, "rejected", `${label} must fail canonical reproduction`);
      if (verification.status === "rejected") {
        assert.deepEqual(
          [...new Set(verification.diagnostics.map((item) => item.code))],
          ["SLICE_V2_AUTHORITY_MISMATCH"],
          `${label} must preserve stable authority-mismatch typing`,
        );
        assert.equal(
          verification.diagnostics.some((item) =>
            item.message.includes("canonical compiler reproduction")),
          true,
          `${label} must identify reproduction mismatch`,
        );
      }
    }
  });

  it("rejects a fully re-hashed graph whose physical control no longer binds ProductSpec placement and action input", async () => {
    const value = await stitchCompilerFixture();
    const forged: any = structuredClone(value.input);
    const control = forged.designGraph.controls[0]!;
    control.controlPlacementHash = sha("forged-placement");
    control.actionInputBindings[0]!.fieldRef = "forged";
    control.actionInputBindings[0]!.actionInputRef = `${control.identity.actionRef}.forged`;
    const graphPayloadHash = hashCanonicalJson(forged.designGraph);
    const graphEnvelopeHash = envelopeHash("setfarm.design-interaction-graph.v2", forged.designGraph);
    forged.storyPlan.designGraphHash = graphPayloadHash;
    forged.designSourceClosure.designGraph.payloadHash = graphPayloadHash;
    forged.designSourceClosure.designGraph.envelopeHash = graphEnvelopeHash;
    forged.packet.designGraphV2Hash = graphEnvelopeHash;
    forged.packet.storyPlanV2Hash = envelopeHash("setfarm.story-plan.v2", forged.storyPlan);
    forged.packet.designSourceClosureV2Hash = envelopeHash(
      "setfarm.design-source-closure.v2",
      forged.designSourceClosure,
    );
    forged.implementationSourceMap.designGraphV2PayloadHash = graphPayloadHash;
    forged.implementationSourceMap.storyPlanV2PayloadHash = hashCanonicalJson(forged.storyPlan);
    forged.implementationSourceMap.designSourceClosureV2PayloadHash = hashCanonicalJson(
      forged.designSourceClosure,
    );
    forged.packet.implementationSourceMapV1Hash = envelopeHash(
      "setfarm.implementation-source-map.v1",
      forged.implementationSourceMap,
    );
    forged.packetHash = envelopeHash("setfarm.product-build-packet.v3", forged.packet);

    const result = compileImplementationSliceV2(forged);
    assert.equal(result.status, "rejected", JSON.stringify(result));
    if (result.status !== "rejected") return;
    assert.equal(result.diagnostics.some((item) => item.code === "SLICE_V2_CONTRACT_INVALID"), true);
    assert.equal(result.diagnostics.some((item) =>
      item.message.includes("controlPlacementHash") || item.message.includes("action-input")), true);
  });

  it("requires every and only accessible current file plus the exact dependency output bytes", async () => {
    const value = await stitchCompilerFixture();
    const missing: any = structuredClone(value.input);
    missing.currentFiles.pop();
    assert.equal(rejectionCodes(missing).includes("SLICE_V2_FILE_SNAPSHOT_INVALID"), true);

    const extra: any = structuredClone(value.input);
    extra.currentFiles.push({ pathRef: "PATH_EXTRA", presence: "present", contentHash: sha("extra") });
    assert.equal(rejectionCodes(extra).includes("SLICE_V2_FILE_SNAPSHOT_INVALID"), true);

    const dependency = dependencyCompilerFixture();
    const compiled = compileOrThrow(dependency.input);
    assert.deepEqual(compiled.slice.dependencyOutputs.map((output) => output.storyId), ["US-001"]);
    assert.equal(compiled.slice.files.find((file) => file.pathRef === "PATH_APP")?.role, "shared_readonly");

    const staleOutput: any = structuredClone(dependency.input);
    staleOutput.currentFiles.find((file: any) => file.pathRef === "PATH_APP")!.contentHash =
      dependency.buildTopology.pathBindings.find((binding) => binding.id === "PATH_APP")!.knownContentHash;
    assert.equal(rejectionCodes(staleOutput).includes("SLICE_V2_DEPENDENCY_OUTPUT_INVALID"), true);

    const missingOutput: any = structuredClone(dependency.input);
    missingOutput.dependencyOutputs = [];
    assert.equal(rejectionCodes(missingOutput).includes("SLICE_V2_DEPENDENCY_OUTPUT_INVALID"), true);
  });

  it("accepts only finding-justified writable recovery deltas and rejects read-only or unrelated deltas", async () => {
    const value = await stitchCompilerFixture();
    const prior = compileOrThrow(value.input);
    const currentHash = sha("shared-write-current");
    const recoveryInput: any = structuredClone(value.input);
    recoveryInput.currentFiles.find((file: any) => file.pathRef === "PATH_SHARED_WRITE")!.contentHash = currentHash;
    recoveryInput.recovery = recoveryDirective(recoveryInput, {
      pathRef: "PATH_SHARED_WRITE",
      currentHash,
      afterHash: sha("shared-write-expected"),
      priorSliceHash: prior.sliceHash,
    });
    const recovered = compileOrThrow(recoveryInput);
    assert.equal(recovered.slice.authority.recoveryHash, hashCanonicalJson(recoveryInput.recovery));

    const wrongBefore: any = structuredClone(recoveryInput);
    wrongBefore.recovery.expectedSourceDelta.changes[0]!.before.contentHash = sha("wrong-before");
    assert.equal(rejectionCodes(wrongBefore).includes("SLICE_V2_FILE_SNAPSHOT_INVALID"), true);

    const readOnlyHash = sha("shared-read-current");
    const readOnly: any = structuredClone(value.input);
    readOnly.currentFiles.find((file: any) => file.pathRef === "PATH_SHARED_READ")!.contentHash = readOnlyHash;
    readOnly.recovery = recoveryDirective(readOnly, {
      pathRef: "PATH_SHARED_READ",
      currentHash: readOnlyHash,
      afterHash: sha("shared-read-expected"),
      priorSliceHash: prior.sliceHash,
    });
    assert.equal(rejectionCodes(readOnly).includes("SLICE_V2_FILE_SNAPSHOT_INVALID"), true);

    const unrelatedDelta: any = structuredClone(recoveryInput);
    const app = unrelatedDelta.buildTopology.pathBindings.find((binding: any) => binding.id === "PATH_APP")!;
    unrelatedDelta.recovery.expectedSourceDelta.changes.push({
      pathRef: "PATH_APP",
      path: app.path,
      before: { presence: app.presence, contentHash: app.knownContentHash },
      after: { presence: "present", contentHash: sha("unrelated-app-after") },
    });
    unrelatedDelta.recovery.expectedSourceDelta.changes.sort((left: any, right: any) =>
      left.pathRef.localeCompare(right.pathRef));
    assert.equal(rejectionCodes(unrelatedDelta).includes("SLICE_V2_CONTRACT_INVALID"), true);
  });
});
