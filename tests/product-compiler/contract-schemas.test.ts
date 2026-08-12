import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BuildTopologyV1Schema } from "../../src/product-compiler/schemas/build-topology-v1.js";
import { DesignInteractionGraphV1Schema } from "../../src/product-compiler/schemas/design-interaction-graph-v1.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { ProductBuildPacketV1Schema } from "../../src/product-compiler/schemas/product-build-packet-v1.js";
import {
  ProductDeliveryV1EnglishWriteSchema,
  ProductDeliveryV1Schema,
  ProductSpecV1EnglishWriteSchema,
  ProductSpecV1Schema,
} from "../../src/product-compiler/schemas/product-spec-v1.js";
import { StoryPlanV1Schema } from "../../src/product-compiler/schemas/story-plan-v1.js";
import {
  buildMinimalValidContracts,
  buildMinimalValidV3Contracts,
} from "./fixtures/minimal-valid-contract.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe("versioned Product Build Packet contract schemas", () => {
  it("accepts one complete minimal contract set", () => {
    const values = buildMinimalValidContracts();
    assert.deepEqual(ProductSpecV1Schema.parse(values.productSpec), values.productSpec);
    assert.deepEqual(DesignInteractionGraphV1Schema.parse(values.designGraph), values.designGraph);
    assert.deepEqual(BuildTopologyV1Schema.parse(values.buildTopology), values.buildTopology);
    assert.deepEqual(StoryPlanV1Schema.parse(values.storyPlan), values.storyPlan);
    assert.deepEqual(ProductBuildPacketV1Schema.parse(values.packet), values.packet);
    assert.deepEqual(
      ImplementationSliceV1Schema.parse(values.implementationSlice),
      values.implementationSlice,
    );
  });

  it("preserves historical delivery reads while restricting new English writes", () => {
    const delivery = {
      platform: "web",
      techStack: "vite-react",
      uiLanguage: "French",
      database: "none",
      designRequired: true,
      uiVisionSummary: "A compact historical interface.",
    };
    assert.equal(ProductDeliveryV1Schema.safeParse(delivery).success, true);
    assert.equal(ProductDeliveryV1EnglishWriteSchema.safeParse(delivery).success, false);

    const historical = clone(buildMinimalValidV3Contracts().productSpec);
    historical.delivery = delivery;
    assert.equal(ProductSpecV1Schema.safeParse(historical).success, true);
    assert.equal(ProductSpecV1EnglishWriteSchema.safeParse(historical).success, false);
  });

  it("rejects unknown fields at every artifact boundary", () => {
    const values = buildMinimalValidContracts();
    const cases = [
      [ProductSpecV1Schema, { ...values.productSpec, runId: "run-1" }],
      [DesignInteractionGraphV1Schema, { ...values.designGraph, guessedIds: [] }],
      [BuildTopologyV1Schema, { ...values.buildTopology, worktree: "/tmp/repo" }],
      [StoryPlanV1Schema, { ...values.storyPlan, agentPrompt: "do the work" }],
      [ProductBuildPacketV1Schema, { ...values.packet, sealedAt: "now" }],
      [ImplementationSliceV1Schema, { ...values.implementationSlice, attemptId: "a-1" }],
    ] as const;
    for (const [schema, value] of cases) {
      assert.equal(schema.safeParse(value).success, false);
    }
  });

  it("rejects unknown fields inside nested contract objects", () => {
    const values = buildMinimalValidContracts();
    const action = clone(values.productSpec);
    (action.actions[0] as unknown as Record<string, unknown>).reviewProse = "looks complete";
    assert.equal(ProductSpecV1Schema.safeParse(action).success, false);

    const control = clone(values.designGraph);
    (control.controls[0] as unknown as Record<string, unknown>).guessedFromLabel = true;
    assert.equal(DesignInteractionGraphV1Schema.safeParse(control).success, false);

    const command = clone(values.buildTopology);
    (command.commands[0] as unknown as Record<string, unknown>).env = { TOKEN: "secret" };
    assert.equal(BuildTopologyV1Schema.safeParse(command).success, false);
  });

  it("rejects malformed stable IDs and non-finite literal values", () => {
    const values = buildMinimalValidContracts();
    const badAction = clone(values.productSpec);
    badAction.actions[0]!.id = "save-action";
    assert.equal(ProductSpecV1Schema.safeParse(badAction).success, false);

    const badLiteral = clone(values.productSpec);
    badLiteral.actions[0]!.stateDeltas[0]!.valueFrom = {
      kind: "literal",
      value: Number.NaN,
    } as never;
    assert.equal(ProductSpecV1Schema.safeParse(badLiteral).success, false);
  });

  it("rejects unresolved references inside ProductSpec", () => {
    const values = buildMinimalValidContracts();
    const missingRoute = clone(values.productSpec);
    missingRoute.surfaces[0]!.routeRef = "ROUTE_MISSING";
    assert.equal(ProductSpecV1Schema.safeParse(missingRoute).success, false);

    const missingState = clone(values.productSpec);
    missingState.actions[0]!.stateDeltas[0]!.stateRef = "STATE_MISSING";
    assert.equal(ProductSpecV1Schema.safeParse(missingState).success, false);

    const missingEvidence = clone(values.productSpec);
    missingEvidence.actions[0]!.evidenceRefs = ["EVID_MISSING"];
    assert.equal(ProductSpecV1Schema.safeParse(missingEvidence).success, false);

    const missingActionSurface = clone(values.productSpec);
    missingActionSurface.actions[0]!.surfaceRefs = ["SURF_MISSING"];
    assert.equal(ProductSpecV1Schema.safeParse(missingActionSurface).success, false);
  });

  it("requires an exact persistence rehydration owner and write-state mapping", () => {
    const values = buildMinimalValidContracts();

    const missingRehydration = clone(values.productSpec);
    missingRehydration.persistencePolicies[0]!.rehydration = { kind: "none" };
    assert.equal(ProductSpecV1Schema.safeParse(missingRehydration).success, false);

    const wrongLayerRehydration = clone(values.productSpec);
    wrongLayerRehydration.persistencePolicies[0]!.rehydration = {
      kind: "action",
      actionRef: "ACT_SAVE_TASK",
    };
    assert.equal(ProductSpecV1Schema.safeParse(wrongLayerRehydration).success, false);

    const unmappedWrite = clone(values.productSpec);
    unmappedWrite.actions[0]!.persistenceEffects[0]!.statePaths = [{
      stateRef: "STATE_EDITOR",
      path: "/uncontracted",
    }];
    assert.equal(ProductSpecV1Schema.safeParse(unmappedWrite).success, false);
  });

  it("requires exactly one binding or unresolved record per interactive control", () => {
    const values = buildMinimalValidContracts();
    const noDisposition = clone(values.designGraph);
    noDisposition.bindings = [];
    assert.equal(DesignInteractionGraphV1Schema.safeParse(noDisposition).success, false);

    const twoDispositions = clone(values.designGraph);
    twoDispositions.bindings.push(clone(twoDispositions.bindings[0]!));
    assert.equal(DesignInteractionGraphV1Schema.safeParse(twoDispositions).success, false);

    const unresolved = clone(values.designGraph);
    unresolved.bindings = [];
    unresolved.unresolvedBindings = [
      {
        controlRef: "CTRL_SAVE_TASK",
        code: "LINK_UNRESOLVED_CONTROL",
        provenance: [],
        suggestions: [],
      },
    ];
    assert.equal(DesignInteractionGraphV1Schema.safeParse(unresolved).success, true);
  });

  it("rejects absolute/traversing paths and conflicting topology ownership", () => {
    const values = buildMinimalValidContracts();
    for (const invalidPath of ["/tmp/App.tsx", "../App.tsx", "src/../App.tsx"]) {
      const topology = clone(values.buildTopology);
      topology.pathBindings[0]!.path = invalidPath;
      assert.equal(BuildTopologyV1Schema.safeParse(topology).success, false);
    }

    const conflict = clone(values.buildTopology);
    conflict.owners.push({
      id: "OWNER_US_002",
      kind: "story",
      storyRef: "US-002",
    });
    conflict.pathBindings.push({
      ...clone(conflict.pathBindings[0]!),
      id: "PATH_APP_DUPLICATE",
      ownerRef: "OWNER_US_002",
    });
    assert.equal(BuildTopologyV1Schema.safeParse(conflict).success, false);

    const duplicateStoryOwner = clone(values.buildTopology);
    duplicateStoryOwner.owners.push({
      id: "OWNER_US_001_DUPLICATE",
      kind: "story",
      storyRef: "US-001",
    });
    assert.equal(BuildTopologyV1Schema.safeParse(duplicateStoryOwner).success, false);
  });

  it("binds a delivery profile reference to the exact topology descriptor", () => {
    const topology = clone(buildMinimalValidContracts().buildTopology) as any;
    topology.deliveryProfile = {
      schema: "setfarm.product-delivery-selection-ref.v1",
      profileId: "PROFILE_WEB_REACT_EXACT_V1",
      catalogVersion: "1.0.0",
      catalogHash: "d".repeat(64),
      selectionHash: "e".repeat(64),
      productClass: "utility",
      stackPackId: topology.stackPack.id,
      designProjection: "exact_stitch_screen_index_v3",
      topologyDescriptorHash: topology.stackPack.contentHash,
    };
    assert.equal(BuildTopologyV1Schema.safeParse(topology).success, true);

    const wrongPack = clone(topology);
    wrongPack.deliveryProfile.stackPackId = "browser-game-canvas";
    assert.equal(BuildTopologyV1Schema.safeParse(wrongPack).success, false);

    const wrongDescriptor = clone(topology);
    wrongDescriptor.deliveryProfile.topologyDescriptorHash = "f".repeat(64);
    assert.equal(BuildTopologyV1Schema.safeParse(wrongDescriptor).success, false);
  });

  it("requires resolvable acyclic story dependencies and unique order", () => {
    const values = buildMinimalValidContracts();
    const storyPlan = clone(values.storyPlan);
    storyPlan.stories.push({
      ...clone(storyPlan.stories[0]!),
      id: "US-002",
      order: 2,
      ownerRef: "OWNER_US_002",
      dependsOn: ["US-001"],
    });
    storyPlan.stories[0]!.dependsOn = ["US-002"];
    assert.equal(StoryPlanV1Schema.safeParse(storyPlan).success, false);

    const duplicateOrder = clone(values.storyPlan);
    duplicateOrder.stories.push({
      ...clone(duplicateOrder.stories[0]!),
      id: "US-002",
    });
    assert.equal(StoryPlanV1Schema.safeParse(duplicateOrder).success, false);
  });

  it("keeps operational metadata out of packet and requires slice source identity", () => {
    const values = buildMinimalValidContracts();
    assert.equal(
      ProductBuildPacketV1Schema.safeParse({
        ...values.packet,
        sealedAt: "2026-07-12T00:00:00Z",
      }).success,
      false,
    );

    const noSource = clone(values.implementationSlice) as Record<string, unknown>;
    delete noSource.sourceRevision;
    assert.equal(ImplementationSliceV1Schema.safeParse(noSource).success, false);
  });

  it("keeps prerequisite and rehydration action closure inside each implementation slice", () => {
    const values = buildMinimalValidContracts();

    const missingPrerequisite = clone(values.implementationSlice);
    missingPrerequisite.contract.actions[0]!.evidenceScenario.prerequisiteSteps = [{
      actionRef: "ACT_PREPARE_TASK",
      inputValues: {},
    }];
    assert.equal(ImplementationSliceV1Schema.safeParse(missingPrerequisite).success, false);

    const missingRehydration = clone(values.implementationSlice);
    missingRehydration.contract.persistencePolicies[0]!.rehydration = {
      kind: "action",
      actionRef: "ACT_LOAD_TASK",
    };
    assert.equal(ImplementationSliceV1Schema.safeParse(missingRehydration).success, false);
  });
});
