import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashRuntimeEvidenceContractV1 } from "../../src/evidence/runtime-evidence-contract-v1.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
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
import {
  implementationSliceHashV2,
} from "../../src/product-compiler/schemas/implementation-slice-v2.js";
import { ProductBuildPacketV3Schema } from "../../src/product-compiler/schemas/product-build-packet-v3.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";
import { hashRuntimeDataContractV1 } from "../../src/product-compiler/schemas/runtime-data-contract-v1.js";
import { compileImplementationSliceV2 } from "../../src/product-compiler/slice-compiler-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

function sha(label: string): string {
  return hashCanonicalJson({ label });
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
  const typedRef = (artifactType: string, label: string, payload: unknown) => ({
    artifactType,
    envelopeHash: sha(`${label}-envelope`),
    payloadHash: hashCanonicalJson(payload),
  });
  return DesignSourceClosureV2Schema.parse({
    schema: "setfarm.design-source-closure.v2",
    kind: "stitch",
    generationTargets: typedRef("setfarm.design-generation-targets.v2", "targets", value.generationTargets),
    directResponseEvidence: typedRef(
      "setfarm.stitch-direct-response-evidence.v2",
      "direct",
      value.directResponseEvidence,
    ),
    renderedSemantics: typedRef(
      "setfarm.stitch-rendered-semantics.v2",
      "rendered",
      value.renderedSemantics,
    ),
    candidateSelection: typedRef(
      "setfarm.stitch-target-candidate-selection.v2",
      "selection",
      value.candidateSelection,
    ),
    responseBindings: typedRef(
      "setfarm.stitch-target-response-bindings.v3",
      "bindings",
      value.responseBindings,
    ),
    designGraph: typedRef("setfarm.design-interaction-graph.v2", "graph", value.graph),
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
  const packet = ProductBuildPacketV3Schema.parse({
    schema: "setfarm.product-build-packet.v3",
    packetVersion: 3,
    parentPacketHashes: [],
    designSourceKind: "stitch",
    productSpecV2Hash: hashCanonicalJson(design.productSpec),
    designGraphV2Hash: hashCanonicalJson(design.graph),
    buildTopologyV1Hash: hashCanonicalJson(buildTopology),
    storyPlanV2Hash: hashCanonicalJson(storyPlan),
    runtimeDataContractHash: buildTopology.runtimeDataContractHash,
    runtimeEvidenceContractHash: buildTopology.runtimeEvidenceContractHash,
    designSourceClosureV2Hash: hashCanonicalJson(designSourceClosure),
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
    packetHash: hashCanonicalJson(packet),
    packet,
    productSpec: design.productSpec,
    designGraph: design.graph,
    buildTopology,
    storyPlan,
    designSourceClosure,
    storyId: story.id,
    sourceRevision,
    currentFiles: buildTopology.pathBindings
      .filter((binding) => accessiblePathRefs.has(binding.id))
      .map((binding) => ({
        pathRef: binding.id,
        presence: binding.presence,
        contentHash: binding.knownContentHash,
      })),
    dependencyOutputs: [],
  };
  return { ...design, buildTopology, storyPlan, designSourceClosure, packet, sourceRevision, input };
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

function twoComponentNoDesignProductSpec() {
  const proposal: any = containedGamePlanProposalV2();
  const requirementRefs = proposal.requirements.map((requirement: any) => requirement.id);
  proposal.states.push({
    key: "settings_mode",
    name: "Settings Mode",
    kind: "application",
    initialValue: { enabled: false },
    invariants: ["The enabled value is boolean."],
    requirementRefs,
  });
  proposal.routes.push({ key: "settings", path: "/settings", entry: false, requirementRefs });
  proposal.surfaces.push({
    key: "settings_page",
    name: "Settings Page",
    kind: "terminal",
    routeKey: "settings",
    required: true,
    composition: { kind: "route_root" },
    requirementRefs,
  });
  proposal.actions.push({
    key: "toggle_settings",
    name: "Toggle Settings",
    controlPlacements: [{
      key: "primary_toggle",
      surfaceKey: "settings_page",
      controlHint: "primary_button",
      requirementRefs,
    }],
    affectedSurfaceKeys: [],
    trigger: { kind: "user", sourceRef: "Toggle Settings" },
    inputs: [],
    preconditions: [],
    evidenceScenario: { controlPlacementKey: "primary_toggle", targetInputValues: {}, prerequisiteSteps: [] },
    stateDeltas: [{
      key: "toggle_value",
      stateKey: "settings_mode",
      operation: "set",
      path: "/enabled",
      valueFrom: { kind: "literal", value: true },
    }],
    navigation: { kind: "stay" },
    persistenceIntents: [],
    observables: [{
      key: "toggle_control",
      selector: { kind: "control", controlPlacementKey: "primary_toggle" },
      assertions: [{ phase: "after", property: "enabled", operator: "equals", expected: true }],
      requirementRefs,
    }],
    requirementRefs,
  });
  const compiled = compilePlanSemanticProposalV2({ task: CONTAINED_GAME_TASK, proposal });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("unreachable");
  const productSpec: any = structuredClone(compiled.productSpec);
  productSpec.delivery = {
    platform: "cli",
    techStack: "node-cli",
    uiLanguage: "English",
    database: "none",
    designRequired: false,
    uiVisionSummary: "A deterministic non-Stitch command interaction contract.",
  };
  productSpec.evidencePredicates.forEach((predicate: any) => {
    predicate.capabilityRefs = ["CAP_CLI_INTERACTION"];
  });
  return ProductSpecV2Schema.parse(productSpec);
}

function dependencyCompilerFixture() {
  const productSpec = twoComponentNoDesignProductSpec();
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
  const packet = ProductBuildPacketV3Schema.parse({
    schema: "setfarm.product-build-packet.v3",
    packetVersion: 3,
    parentPacketHashes: [],
    designSourceKind: "none",
    productSpecV2Hash: hashCanonicalJson(productSpec),
    designGraphV2Hash: null,
    buildTopologyV1Hash: hashCanonicalJson(buildTopology),
    storyPlanV2Hash: hashCanonicalJson(storyPlan),
    designSourceClosureV2Hash: hashCanonicalJson(designSourceClosure),
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
      packetHash: hashCanonicalJson(packet),
      packet,
      productSpec,
      designGraph: null,
      buildTopology,
      storyPlan,
      designSourceClosure,
      storyId: story.id,
      sourceRevision: { sha: "9".repeat(40), treeHash: "a".repeat(40) },
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
    assert.equal(first.sliceHash, implementationSliceHashV2(first.slice));
    assert.deepEqual(first.slice.files.map((file) => [file.pathRef, file.role]), [
      ["PATH_APP", "owned"],
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
  });

  it("rejects a fully re-hashed graph whose physical control no longer binds ProductSpec placement and action input", async () => {
    const value = await stitchCompilerFixture();
    const forged: any = structuredClone(value.input);
    const control = forged.designGraph.controls[0]!;
    control.controlPlacementHash = sha("forged-placement");
    control.actionInputBindings[0]!.fieldRef = "forged";
    control.actionInputBindings[0]!.actionInputRef = `${control.identity.actionRef}.forged`;
    const graphHash = hashCanonicalJson(forged.designGraph);
    forged.storyPlan.designGraphHash = graphHash;
    forged.designSourceClosure.designGraph.payloadHash = graphHash;
    forged.packet.designGraphV2Hash = graphHash;
    forged.packet.storyPlanV2Hash = hashCanonicalJson(forged.storyPlan);
    forged.packet.designSourceClosureV2Hash = hashCanonicalJson(forged.designSourceClosure);
    forged.packetHash = hashCanonicalJson(forged.packet);

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
