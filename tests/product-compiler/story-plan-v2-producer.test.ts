import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceDesignInteractionGraphV2 } from "../../src/product-compiler/producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { captureStitchRenderedSemanticsV2 } from "../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import { produceStoryPartitionV2 } from "../../src/product-compiler/producers/story-partition-v2.js";
import { produceStoryPlanV2 } from "../../src/product-compiler/producers/story-plan-v2.js";
import { compileRuntimeStoryPlanV2 } from "../../src/product-compiler/runtime-story-plan-compiler-v2.js";
import { BuildTopologyV1Schema } from "../../src/product-compiler/schemas/build-topology-v1.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";
import { StoryPlanV2Schema } from "../../src/product-compiler/schemas/story-plan-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

function strictProductSpec(options: Readonly<{
  twoComponents?: boolean;
  shareStateAcrossRoutes?: boolean;
}> = {}) {
  const proposal: any = containedGamePlanProposalV2();
  if (options.twoComponents) {
    const requirementRefs = proposal.requirements.map((requirement: any) => requirement.id);
    proposal.requirements.forEach((requirement: any) => {
      if (!requirement.expectedSemanticKinds.includes("persistence")) {
        requirement.expectedSemanticKinds.push("persistence");
      }
    });
    if (!options.shareStateAcrossRoutes) {
      proposal.states.push({
        key: "settings_mode",
        name: "Settings Mode",
        kind: "application",
        initialValue: { enabled: false },
        invariants: ["The enabled value is boolean."],
        requirementRefs,
      });
    }
    proposal.persistencePolicies.push({
      key: "settings_local",
      kind: "local_storage",
      entityKeys: [],
      rehydration: { kind: "initialization" },
      requirementRefs,
    });
    proposal.routes.push({
      key: "settings",
      path: "/settings",
      entry: false,
      requirementRefs,
    });
    proposal.surfaces.push({
      key: "settings_page",
      name: "Settings Page",
      kind: "page",
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
      evidenceScenario: {
        controlPlacementKey: "primary_toggle",
        targetInputValues: {},
        prerequisiteSteps: [],
      },
      stateDeltas: [{
        key: "toggle_value",
        stateKey: options.shareStateAcrossRoutes ? "game_phase" : "settings_mode",
        operation: "set",
        path: options.shareStateAcrossRoutes ? "/phase" : "/enabled",
        valueFrom: {
          kind: "literal",
          value: options.shareStateAcrossRoutes ? "playing" : true,
        },
      }],
      navigation: { kind: "stay" },
      persistenceIntents: [{
        policyKey: "settings_local",
        operation: "write",
        stateDeltaKeys: ["toggle_value"],
      }],
      observables: [{
        key: "toggle_control",
        selector: { kind: "control", controlPlacementKey: "primary_toggle" },
        assertions: [
          { phase: "after", property: "enabled", operator: "equals", expected: true },
          { phase: "reload", property: "enabled", operator: "equals", expected: true },
        ],
        requirementRefs,
      }],
      requirementRefs,
    });
  }
  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal,
  });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("unreachable");
  return ProductSpecV2Schema.parse(compiled.productSpec);
}

function topologyFor(productSpec: ReturnType<typeof strictProductSpec>, twoStories = false) {
  const topology: any = {
    schema: "setfarm.build-topology.v1",
    stackPack: {
      id: "vite-react",
      version: "1.0.0",
      contentHash: "a".repeat(64),
    },
    repo: {
      id: "story-plan-v2-test",
      baseSha: "b".repeat(40),
      treeHash: "c".repeat(40),
    },
    owners: [{ id: "OWNER_US_001", kind: "story", storyRef: "US-001" }],
    pathBindings: [{
      id: "PATH_APP",
      path: "src/App.tsx",
      role: "source",
      ownerRef: "OWNER_US_001",
      presence: "present",
      knownContentHash: "a".repeat(64),
    }],
    sharedGrants: [],
    entrypoints: [{
      id: "ENTRY_WEB",
      kind: "web",
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
  };
  if (twoStories) {
    topology.owners.push({ id: "OWNER_US_002", kind: "story", storyRef: "US-002" });
    topology.pathBindings.push({
      id: "PATH_SETTINGS",
      path: "src/Settings.tsx",
      role: "source",
      ownerRef: "OWNER_US_002",
      presence: "present",
      knownContentHash: "d".repeat(64),
    });
    topology.sharedGrants.push({
      id: "GRANT_APP_TO_SETTINGS",
      fromOwnerRef: "OWNER_US_001",
      toOwnerRef: "OWNER_US_002",
      pathRefs: ["PATH_APP"],
      permissions: ["read"],
    });
  }
  return BuildTopologyV1Schema.parse(topology);
}

async function exactDesignFixture() {
  const productSpec = strictProductSpec();
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
    `<section data-surface-id="${statusSurface}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
    "</main>",
  ].join(""), "story-plan-v2");
  const screenshotBytes = validStitchPng(231);
  const screenId = "screen-story-plan-v2";
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "story-plan-v2-test",
    batches: [{
      stageId: "stage-story-plan-v2",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: [{
        screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens.screen-story-plan-v2"],
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
  const graph = produceDesignInteractionGraphV2({
    productSpec,
    generationTargets,
    renderedSemantics: rendered.artifact,
    candidateSelection: selected.candidateSelection,
    responseBindings: bound.responseBindings,
  }).designGraph;
  return { productSpec, graph, target, placement, statusSurface, canvasSurface };
}

function flattened(stories: readonly any[], field: string): string[] {
  return stories.flatMap((story) => story[field]).sort();
}

describe("StoryPlanV2 direct producer/compiler", { concurrency: 1 }, () => {
  it("partitions two independent ProductSpecV2 components and joins exact topology ownership", () => {
    const productSpec = strictProductSpec({ twoComponents: true });
    const buildTopology = topologyFor(productSpec, true);
    const first = compileRuntimeStoryPlanV2({ productSpec, buildTopology });
    const second = compileRuntimeStoryPlanV2({
      productSpec: structuredClone(productSpec),
      buildTopology: structuredClone(buildTopology),
    });
    assert.equal(first.status, "compiled", JSON.stringify(first));
    assert.equal(second.status, "compiled", JSON.stringify(second));
    if (first.status !== "compiled" || second.status !== "compiled") return;
    assert.deepEqual(second.storyPlan, first.storyPlan);
    const plan = first.storyPlan;
    assert.deepEqual(StoryPlanV2Schema.parse(plan), plan);
    assert.equal(plan.designSourceKind, "none");
    assert.equal(plan.designGraphHash, null);
    assert.equal(plan.productSpecHash, hashCanonicalJson(productSpec));
    assert.equal(plan.buildTopologyHash, hashCanonicalJson(buildTopology));
    assert.equal(plan.partitionHash, hashCanonicalJson(plan.stories));
    assert.deepEqual(plan.stories.map((story) => story.id), ["US-001", "US-002"]);
    assert.deepEqual(plan.stories[1]!.dependsOn, ["US-001"]);
    assert.equal(plan.stories[0]!.ownerRef, "OWNER_US_001");
    assert.deepEqual(plan.stories[0]!.ownedPathRefs, ["PATH_APP"]);
    assert.equal(plan.stories[1]!.ownerRef, "OWNER_US_002");
    assert.deepEqual(plan.stories[1]!.ownedPathRefs, ["PATH_SETTINGS"]);
    assert.deepEqual(plan.stories[1]!.sharedGrantRefs, ["GRANT_APP_TO_SETTINGS"]);

    assert.deepEqual(flattened(plan.stories, "routeRefs"), productSpec.routes.map((item) => item.id).sort());
    assert.deepEqual(flattened(plan.stories, "surfaceRefs"), productSpec.surfaces.map((item) => item.id).sort());
    assert.deepEqual(
      flattened(plan.stories, "controlSlotRefs"),
      productSpec.actions.flatMap((action) => action.controlPlacements.map((item) => item.id)).sort(),
    );
    assert.deepEqual(flattened(plan.stories, "controlRefs"), []);
    assert.deepEqual(flattened(plan.stories, "actionRefs"), productSpec.actions.map((item) => item.id).sort());
    assert.deepEqual(
      flattened(plan.stories, "observableRefs"),
      productSpec.actions.flatMap((action) => action.observableEffects.map((item) => item.id)).sort(),
    );
    assert.deepEqual(flattened(plan.stories, "stateRefs"), productSpec.states.map((item) => item.id).sort());
    assert.deepEqual(
      flattened(plan.stories, "persistenceRefs"),
      productSpec.persistencePolicies.map((item) => item.id).sort(),
    );
    assert.deepEqual(
      flattened(plan.stories, "evidenceRefs"),
      productSpec.evidencePredicates.filter((item) => item.required).map((item) => item.id).sort(),
    );
    assert.equal(plan.cardinality.stories, 2);
    assert.equal(plan.cardinality.controlSlots, 2);
    assert.equal(plan.cardinality.physicalControls, 0);
    assert.equal(plan.cardinality.persistencePolicies, 1);
  });

  it("joins otherwise separate routes when their actions share one canonical state", () => {
    const productSpec = strictProductSpec({
      twoComponents: true,
      shareStateAcrossRoutes: true,
    });
    const buildTopology = topologyFor(productSpec);
    const result = produceStoryPlanV2({ productSpec, buildTopology });
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    assert.equal(result.storyPlan.stories.length, 1);
    assert.deepEqual(
      result.storyPlan.stories[0]!.routeRefs,
      productSpec.routes.map((route) => route.id).sort(),
    );
    assert.deepEqual(
      result.storyPlan.stories[0]!.actionRefs,
      productSpec.actions.map((action) => action.id).sort(),
    );
    assert.deepEqual(result.storyPlan.stories[0]!.stateRefs, ["STATE_GAME_PHASE"]);
    assert.deepEqual(result.storyPlan.stories[0]!.persistenceRefs, ["PERSIST_SETTINGS_LOCAL"]);
  });

  it("keeps action, slot, physical control, root/contained surfaces, and observables in one exact owner", async () => {
    const value = await exactDesignFixture();
    const buildTopology = topologyFor(value.productSpec);
    const result = produceStoryPlanV2({
      productSpec: value.productSpec,
      designGraph: value.graph,
      buildTopology,
    });
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    const plan = result.storyPlan;
    assert.equal(plan.designSourceKind, "stitch");
    assert.equal(plan.designGraphHash, hashCanonicalJson(value.graph));
    assert.equal(plan.stories.length, 1);
    const story = plan.stories[0]!;
    assert.deepEqual(
      story.surfaceRefs,
      [value.target.surfaceRef, value.canvasSurface, value.statusSurface].sort(),
    );
    assert.deepEqual(story.controlSlotRefs, [value.placement.controlSlotRef]);
    assert.deepEqual(story.controlRefs, [value.graph.controls[0]!.id]);
    assert.deepEqual(story.actionRefs, [value.placement.actionRef]);
    assert.deepEqual(
      story.observableRefs,
      value.productSpec.actions[0]!.observableEffects.map((item) => item.id).sort(),
    );
    assert.equal(story.controlRefs.length, 1, "affected canvas/status surfaces cannot mint controls");
    assert.equal(plan.cardinality.surfaces, 3);
    assert.equal(plan.cardinality.controlSlots, 1);
    assert.equal(plan.cardinality.physicalControls, 1);
  });

  it("rejects graph, topology owner/path/grant, and capability drift with exact v2 codes", async () => {
    const value = await exactDesignFixture();
    const buildTopology = topologyFor(value.productSpec);
    const forgedGraph: any = structuredClone(value.graph);
    forgedGraph.productSpecHash = "f".repeat(64);
    const graphResult = produceStoryPartitionV2({
      productSpec: value.productSpec,
      designGraph: forgedGraph,
    });
    assert.equal(graphResult.status, "rejected");
    if (graphResult.status === "rejected") {
      assert.equal(
        graphResult.rejectionCodes.includes("STORY_PARTITION_V2_DESIGN_GRAPH_PRODUCT_HASH_MISMATCH"),
        true,
      );
    }

    const twoProduct = strictProductSpec({ twoComponents: true });
    const ownerDrift: any = structuredClone(topologyFor(twoProduct, true));
    ownerDrift.owners.find((owner: any) => owner.storyRef === "US-002")!.storyRef = "US-999";
    const ownerResult = produceStoryPlanV2({ productSpec: twoProduct, buildTopology: ownerDrift });
    assert.equal(ownerResult.status, "rejected");
    if (ownerResult.status === "rejected") {
      assert.equal(ownerResult.rejectionCodes.includes("STORY_PLAN_V2_TOPOLOGY_OWNER_SET_MISMATCH"), true);
    }

    const pathDrift: any = structuredClone(topologyFor(twoProduct, true));
    pathDrift.pathBindings = pathDrift.pathBindings.filter((path: any) => path.id !== "PATH_SETTINGS");
    const pathResult = produceStoryPlanV2({ productSpec: twoProduct, buildTopology: pathDrift });
    assert.equal(pathResult.status, "rejected");
    if (pathResult.status === "rejected") {
      assert.equal(pathResult.rejectionCodes.includes("STORY_PLAN_V2_OWNED_PATH_MISSING"), true);
    }

    const grantDrift: any = structuredClone(topologyFor(twoProduct, true));
    grantDrift.sharedGrants[0]!.pathRefs = ["PATH_SETTINGS"];
    const grantResult = produceStoryPlanV2({ productSpec: twoProduct, buildTopology: grantDrift });
    assert.equal(grantResult.status, "rejected");
    if (grantResult.status === "rejected") {
      assert.equal(
        grantResult.rejectionCodes.includes("STORY_PLAN_V2_GRANT_SOURCE_PATH_OWNER_MISMATCH"),
        true,
      );
    }

    const disabled: any = structuredClone(buildTopology);
    disabled.capabilities.find((capability: any) =>
      capability.id === "CAP_BROWSER_INTERACTION")!.enabled = false;
    const capabilityResult = produceStoryPlanV2({
      productSpec: value.productSpec,
      designGraph: value.graph,
      buildTopology: disabled,
    });
    assert.equal(capabilityResult.status, "rejected");
    if (capabilityResult.status === "rejected") {
      assert.equal(
        capabilityResult.rejectionCodes.includes("STORY_PLAN_V2_EVIDENCE_CAPABILITY_UNAVAILABLE"),
        true,
      );
    }
  });

  it("never accepts or adapts v1 ProductSpec/DesignGraph artifacts", () => {
    const productSpec = strictProductSpec();
    const result = compileRuntimeStoryPlanV2({
      productSpec: { schema: "setfarm.product-spec.v1" },
      designGraph: { schema: "setfarm.design-interaction-graph.v1" },
      buildTopology: topologyFor(productSpec),
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(result.rejectionCodes, ["STORY_PLAN_V2_INPUT_INVALID"]);
  });
});
