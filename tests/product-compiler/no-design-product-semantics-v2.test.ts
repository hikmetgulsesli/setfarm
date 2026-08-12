import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { PlanSemanticProposalV2Schema } from "../../src/product-compiler/schemas/plan-semantic-proposal-v2.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  NODE_CLI_TASK,
  NODE_EXPRESS_API_TASK,
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
  nodeCliPlanProposalV2,
  nodeExpressApiPlanProposalV2,
} from "./fixtures/no-design-product-semantics-v2.js";

describe("genuine no-design Product Semantics v2 fixtures", () => {
  it("models a Node CLI without mutating browser or game semantics", () => {
    const proposal = PlanSemanticProposalV2Schema.parse(nodeCliPlanProposalV2());
    const product = genuineNodeCliProductSpecV2();

    assert.equal(proposal.product.class, "developer_tool");
    assert.equal(proposal.actions[0]!.invocationInterface.kind, "cli_command");
    assert.equal(product.delivery.platform, "cli");
    assert.equal(product.delivery.techStack, "node-cli");
    assert.equal(product.delivery.designRequired, false);
    assert.equal(product.actions[0]!.controlPlacements.length, 0);
    assert.equal(product.actions[0]!.observableEffects[0]!.selector.kind, "invocation_output");
    assert.equal(product.evidencePredicates.every((predicate) =>
      predicate.capabilityRefs.length === 0), true);
    assert.deepEqual(ProductSpecV2Schema.parse(product), product);
  });

  it("models a Node Express API with exact path and JSON-body channels", () => {
    const proposal = PlanSemanticProposalV2Schema.parse(nodeExpressApiPlanProposalV2());
    const product = genuineNodeExpressApiProductSpecV2();
    const action = product.actions[0]!;

    assert.equal(proposal.product.class, "service");
    assert.equal(action.invocationInterface.kind, "http_request");
    if (action.invocationInterface.kind !== "http_request") throw new Error("unreachable");
    assert.equal(product.delivery.platform, "api");
    assert.equal(product.delivery.techStack, "node-express");
    assert.equal(product.delivery.database, "none");
    assert.equal(product.delivery.designRequired, false);
    assert.equal(product.routes[0]!.path, "/tasks/:project");
    assert.deepEqual(action.invocationInterface.fieldBindings.map((binding) => binding.fieldName), [
      "project",
      "title",
    ]);
    assert.deepEqual(action.invocationInterface.fieldBindings[1]!.channel, {
      kind: "json_body_pointer",
      pointer: "/title",
      containerPolicy: "object_intermediates",
    });
    assert.equal(product.evidencePredicates.every((predicate) =>
      predicate.capabilityRefs.length === 0), true);
  });

  it("keeps both genuine products behind the standalone V2 compiler blocker", () => {
    for (const [task, proposal] of [
      [NODE_CLI_TASK, nodeCliPlanProposalV2()],
      [NODE_EXPRESS_API_TASK, nodeExpressApiPlanProposalV2()],
    ] as const) {
      const result = compilePlanSemanticProposalV2({ task, proposal });
      assert.equal(result.status, "rejected");
      if (result.status !== "rejected") continue;
      assert.equal(result.diagnostics.some((diagnostic) =>
        diagnostic.code === "PLAN_SEMANTIC_PROPOSAL_V2_INVOCATION_PROFILE_UNAVAILABLE"), true);
    }
  });
});
