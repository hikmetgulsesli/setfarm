import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { produceStoryPartitionV3 } from
  "../../src/product-compiler/producers/story-partition-v3.js";
import { ProductSpecV2Schema } from
  "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  entityFieldNodeExpressApiProductSpecV2,
  entityFieldNodeRuntimeBehaviorAuthorityV1,
  genuineNodeExpressApiProductSpecV2,
  nodeRuntimeBehaviorAuthorityV1,
} from "./fixtures/no-design-product-semantics-v2.js";

describe("StoryPartitionV3 producer", () => {
  it("closes entity, snapshot state, action and evidence into one exact component", () => {
    const productSpec = entityFieldNodeExpressApiProductSpecV2();
    const behavior = entityFieldNodeRuntimeBehaviorAuthorityV1(productSpec);
    const result = produceStoryPartitionV3({
      productSpec,
      designGraph: null,
      ...behavior,
    });
    assert.equal(
      result.status,
      "produced",
      result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
    );
    if (result.status !== "produced") return;
    assert.equal(result.components.length, 1);
    assert.deepEqual(result.components[0], {
      componentHash:
        "9a3d1a70924a648ad7b88a42bd7d83bf00d5a3283b78792a9b197127abbc4ad3",
      routeRefs: ["ROUTE_TASKS"],
      surfaceRefs: ["SURF_TASK_API"],
      controlSlotRefs: [],
      controlRefs: [],
      actionRefs: ["ACT_CREATE_TASK"],
      observableRefs: ["OBS_TASK_CREATED"],
      stateRefs: ["STATE_TASKS", "STATE_TASK_CATALOG"],
      persistenceRefs: [],
      evidenceRefs: [
        "EVID_INVOCATION_2F40B124F10050255146D31D788DB85013AB2F15E05D2AEE1C336E45D763A50F",
        "EVID_TASK_CREATED",
      ],
      entityRefs: ["ENTITY_TASK_CATALOG_ENTRY"],
    });
  });

  it("requires one fresh behavior pair for entity ownership", () => {
    const productSpec = entityFieldNodeExpressApiProductSpecV2();
    const missing = produceStoryPartitionV3({ productSpec, designGraph: null });
    assert.equal(missing.status, "rejected");
    if (missing.status === "rejected") {
      assert.deepEqual(missing.rejectionCodes, [
        "STORY_PARTITION_V3_BEHAVIOR_AUTHORITY_REQUIRED",
      ]);
    }

    const behavior = entityFieldNodeRuntimeBehaviorAuthorityV1(productSpec);
    const incomplete = produceStoryPartitionV3({
      productSpec,
      designGraph: null,
      runtimeBehaviorProposal: behavior.runtimeBehaviorProposal,
    });
    assert.equal(incomplete.status, "rejected");
    if (incomplete.status === "rejected") {
      assert.deepEqual(incomplete.rejectionCodes, [
        "STORY_PARTITION_V3_INPUT_INVALID",
      ]);
    }
  });

  it("rejects cross-product behavior and unowned catalog entities", () => {
    const productSpec = entityFieldNodeExpressApiProductSpecV2();
    const otherProduct = genuineNodeExpressApiProductSpecV2();
    const wrongBehavior = nodeRuntimeBehaviorAuthorityV1(otherProduct);
    const crossProduct = produceStoryPartitionV3({
      productSpec,
      designGraph: null,
      ...wrongBehavior,
    });
    assert.equal(crossProduct.status, "rejected");
    if (crossProduct.status === "rejected") {
      assert.deepEqual(crossProduct.rejectionCodes, [
        "STORY_PARTITION_V3_BEHAVIOR_AUTHORITY_INVALID",
      ]);
    }

    const unownedValue = structuredClone(productSpec);
    unownedValue.entities.push({
      id: "ENTITY_UNUSED",
      name: "Unused",
      fields: [{
        id: "FIELD_UNUSED_NAME",
        name: "name",
        valueType: "string",
        required: true,
      }],
    });
    unownedValue.traceability.bindings.push({
      semanticKind: "entity",
      semanticRef: "ENTITY_UNUSED",
      requirementRefs: [
        ...unownedValue.traceability.bindings.find((binding) =>
          binding.semanticKind === "entity")!.requirementRefs,
      ],
    });
    unownedValue.traceability.bindings.sort((left, right) =>
      left.semanticKind.localeCompare(right.semanticKind)
      || left.semanticRef.localeCompare(right.semanticRef));
    const unownedProduct = ProductSpecV2Schema.parse(unownedValue);
    const unownedBehavior = entityFieldNodeRuntimeBehaviorAuthorityV1(unownedProduct);
    const unowned = produceStoryPartitionV3({
      productSpec: unownedProduct,
      designGraph: null,
      ...unownedBehavior,
    });
    assert.equal(unowned.status, "rejected");
    if (unowned.status === "rejected") {
      assert.ok(unowned.rejectionCodes.includes(
        "STORY_PARTITION_V3_ENTITY_UNOWNED",
      ));
    }
  });
});
