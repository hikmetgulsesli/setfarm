import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalProductDeliveryProfileCatalogV1,
  getProductDeliveryProfileCatalogV1,
  productDeliveryProfileCatalogHashV1,
  resolveProductDeliverySelectionV1,
  verifyProductDeliverySelectionV1,
} from "../../src/product-compiler/product-delivery-profile-catalog.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { getStackTopologyCatalogContract } from "../../src/product-compiler/stack-topology-catalog.js";
import { getStackPack } from "../../src/installer/stack-contract/packs.js";
import { planModule } from "../../src/installer/steps/01-plan/module.js";
import { productEvidenceCapabilityPolicyHashV1 } from "../../src/product-compiler/product-evidence-capability-policy.js";

describe("Product Delivery Profile catalog", () => {
  it("owns one exact activated delivery for utility, operations, and game", () => {
    const utility = resolveProductDeliverySelectionV1({ productClass: "utility" });
    const operations = resolveProductDeliverySelectionV1({ productClass: "operations" });
    const game = resolveProductDeliverySelectionV1({ productClass: "game" });

    assert.equal(utility.status, "selected");
    assert.equal(operations.status, "selected");
    assert.equal(game.status, "selected");
    if (utility.status !== "selected" || operations.status !== "selected" || game.status !== "selected") return;
    assert.equal(utility.selection.stackPackId, "vite-react-web-app");
    assert.equal(operations.selection.stackPackId, "vite-react-web-app");
    assert.equal(game.selection.stackPackId, "browser-game-canvas");
    assert.equal(utility.selection.design.projection, "exact_stitch_screen_index_v3");
    assert.equal(game.selection.design.projection, "exact_stitch_screen_index_v3");
    assert.equal(utility.canonicalBytes, canonicalJsonStringify(utility.selection));
    assert.equal(utility.selectionHash, hashCanonicalJson(utility.selection));
  });

  it("binds every profile to an exact topology descriptor and matching setup projection policy", () => {
    const catalog = getProductDeliveryProfileCatalogV1();
    for (const profile of catalog.profiles) {
      const topology = getStackTopologyCatalogContract(profile.stackPackId);
      assert.ok(topology);
      assert.equal(profile.topology.catalogVersion, topology.identity.version);
      assert.equal(profile.topology.descriptorHash, topology.identity.contentHash);
      assert.equal(profile.evidenceCapabilities.policyHash, productEvidenceCapabilityPolicyHashV1());
      assert.equal(profile.evidenceCapabilities.policySchema, "setfarm.product-evidence-capability-policy.v1");
      const setupPack = getStackPack(profile.stackPackId);
      assert.equal(setupPack.designPolicy, profile.design.policy);
      assert.equal(setupPack.conversionPolicy, profile.design.conversionPolicy);
    }
    assert.equal(canonicalProductDeliveryProfileCatalogV1(), canonicalJsonStringify(catalog));
    assert.equal(productDeliveryProfileCatalogHashV1(), hashCanonicalJson(catalog));
  });

  it("rejects unactivated classes and incompatible explicit stack prefixes before setup", () => {
    const unsupported = resolveProductDeliverySelectionV1({ productClass: "content" });
    const staticHtml = resolveProductDeliverySelectionV1({
      productClass: "utility",
      requestedStackPackId: "static-html-site",
    });

    assert.equal(unsupported.status, "rejected");
    assert.equal(staticHtml.status, "rejected");
    if (unsupported.status !== "rejected" || staticHtml.status !== "rejected") return;
    assert.deepEqual(unsupported.diagnostics.map((item) => item.code), ["PRODUCT_DELIVERY_PROFILE_UNSUPPORTED"]);
    assert.deepEqual(staticHtml.diagnostics.map((item) => item.code), ["PRODUCT_DELIVERY_EXPLICIT_STACK_UNSUPPORTED"]);
  });

  it("rejects a structurally valid selection copied from a different catalog identity", () => {
    const selected = resolveProductDeliverySelectionV1({ productClass: "utility" });
    assert.equal(selected.status, "selected");
    if (selected.status !== "selected") return;
    const stale = structuredClone(selected.selection);
    stale.catalogHash = "0".repeat(64);

    assert.throws(
      () => verifyProductDeliverySelectionV1(stale),
      /PRODUCT_DELIVERY_SELECTION_CATALOG_MISMATCH/,
    );
  });

  it("puts the complete catalog and explicit request boundary in the first PLAN prompt", () => {
    const catalog = canonicalProductDeliveryProfileCatalogV1();
    const prompt = planModule.buildPrompt({
      task: "Build a single-page preference utility.",
      context: {
        plan_protocol: "v3",
        task: "Build a single-page preference utility.",
        v3_requirement_ledger: "{}",
        v3_delivery_profile_catalog: catalog,
        v3_delivery_profile_catalog_hash: productDeliveryProfileCatalogHashV1(),
        v3_requested_stack_pack_id: "static-html-site",
      },
    } as any);

    assert.match(prompt, /Setfarm-owned Product Delivery Profile Catalog/);
    assert.match(prompt, /PROFILE_WEB_REACT_EXACT_V1/);
    assert.match(prompt, /PROFILE_BROWSER_GAME_REACT_CANVAS_EXACT_V1/);
    assert.match(prompt, /explicitly requested stack pack static-html-site/);
    assert.match(prompt, /Static HTML and reference-only design stacks are not activated/);
  });
});
