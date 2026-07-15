import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ProductEvidenceCapabilityPolicyV1Schema,
  canonicalProductEvidenceCapabilityPolicyV1,
  compileProductEvidenceCapabilitiesV1,
  getProductEvidenceCapabilityPolicyV1,
  productEvidenceCapabilityPolicyHashV1,
} from "../../src/product-compiler/product-evidence-capability-policy.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

describe("compiler-owned evidence capability policy", () => {
  it("publishes one deterministic versioned rule for every semantic input kind", () => {
    const policy = getProductEvidenceCapabilityPolicyV1();
    assert.deepEqual(ProductEvidenceCapabilityPolicyV1Schema.parse(policy), policy);
    assert.equal(policy.owner, "product_compiler");
    assert.equal(policy.plannerCapabilityRefsDisposition, "ignored");
    assert.equal(policy.evidenceRules.length, 11);
    assert.equal(policy.triggerRules.length, 4);
    assert.equal(policy.persistenceRules.length, 6);
    assert.equal(productEvidenceCapabilityPolicyHashV1(), hashCanonicalJson(policy));
    assert.equal(JSON.parse(canonicalProductEvidenceCapabilityPolicyV1()).schema, policy.schema);
  });

  it("replaces invented planner IDs with exact Vite topology capabilities", () => {
    const productSpec: any = structuredClone(buildMinimalValidContracts().productSpec);
    productSpec.evidencePredicates[0].capabilityRefs = ["CAP_BROWSER_RUN", "CAP_LOCAL_STORAGE"];

    const result = compileProductEvidenceCapabilitiesV1({
      productSpec,
      stackPackId: "vite-react-web-app",
    });

    assert.equal(result.status, "compiled");
    if (result.status !== "compiled") return;
    assert.deepEqual(result.productSpec.evidencePredicates[0]!.capabilityRefs, [
      "CAP_BROWSER_INTERACTION",
      "CAP_LOCAL_PERSISTENCE",
    ]);
  });

  it("binds timer evidence to the game topology without a project-specific alias", () => {
    const productSpec: any = structuredClone(buildMinimalValidContracts().productSpec);
    productSpec.product.class = "game";
    productSpec.actions[0].trigger = { kind: "timer", sourceRef: "GAME_CLOCK" };
    productSpec.evidencePredicates[0].capabilityRefs = [];

    const result = compileProductEvidenceCapabilitiesV1({
      productSpec,
      stackPackId: "browser-game-canvas",
    });

    assert.equal(result.status, "compiled");
    if (result.status !== "compiled") return;
    assert.deepEqual(result.productSpec.evidencePredicates[0]!.capabilityRefs, [
      "CAP_GAME_TIMING",
      "CAP_LOCAL_PERSISTENCE",
    ]);
  });

  it("rejects a semantic evidence need when the selected topology has no exact capability", () => {
    const productSpec: any = structuredClone(buildMinimalValidContracts().productSpec);
    productSpec.evidencePredicates[0].kind = "download";
    productSpec.evidencePredicates[0].capabilityRefs = [];

    const result = compileProductEvidenceCapabilitiesV1({
      productSpec,
      stackPackId: "vite-react-web-app",
    });

    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.diagnostics.some((item) =>
      item.code === "PRODUCT_SPEC_EVIDENCE_CAPABILITY_UNAVAILABLE"
      && item.reference === "download"
      && item.path === "/evidencePredicates/0/capabilityRefs"), true);
  });
});
