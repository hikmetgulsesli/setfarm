import { hashCanonicalJson } from "../../../src/product-compiler/canonical-json.js";
import { compilePlanSemanticProposalV2 } from "../../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { produceDesignInteractionGraphV2 } from "../../../src/product-compiler/producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../../src/product-compiler/producers/design-targets-v2.js";
import { captureStitchRenderedSemanticsV2 } from "../../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
} from "../../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import { produceStoryPlanV2 } from "../../../src/product-compiler/producers/story-plan-v2.js";
import { BuildTopologyV1Schema } from "../../../src/product-compiler/schemas/build-topology-v1.js";
import { ProductSpecV2Schema } from "../../../src/product-compiler/schemas/product-spec-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./stitch-artifacts.js";

function topologyFor(productSpecV2: any, entrypointKind: "cli" | "game") {
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
      role: "source",
      ownerRef: "OWNER_US_001",
      presence: "present",
      knownContentHash: "e".repeat(64),
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
  return {
    productSpecV2,
    designGraphV2: null,
    buildTopologyV1,
    storyPlanV2: stories.storyPlan,
    designSourceClosureV2: {
      schema: "setfarm.design-source-closure.v2" as const,
      kind: "none" as const,
      reason: "product_delivery_design_not_required" as const,
    },
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
  const buildTopologyV1 = topologyFor(productSpecV2, "game");
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
  return {
    productSpecV2,
    designGraphV2,
    buildTopologyV1,
    storyPlanV2: stories.storyPlan,
    designSourceClosureV2: {
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
    },
    designSourceArtifactsV2: {
      generationTargets,
      directResponseEvidence,
      renderedSemantics: rendered.artifact,
      candidateSelection: selected.candidateSelection,
      responseBindings: bound.responseBindings,
    },
  };
}
