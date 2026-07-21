import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

async function source(relativePath: string): Promise<string> {
  return readFile(path.resolve(relativePath), "utf8");
}

describe("artifact store production factory census", () => {
  it("routes every production artifact reader through the central runtime factory", async () => {
    const consumers = [
      "src/evidence/accepted-candidate-repository.ts",
      "src/evals/convergence-runner.ts",
      "src/execution/v3-deploy-executor.ts",
      "src/execution/v3-implementation-attempt.ts",
      "src/findings/v3-github-review-router.ts",
      "src/installer/step-ops.ts",
      "src/recovery/v3-downstream-evidence-router.ts",
      "src/server/dashboard.ts",
      "src/server/run-operational-snapshot.ts",
    ];
    for (const file of consumers) {
      const value = await source(file);
      assert.match(value, /createRuntimeArtifactReader/, file);
      assert.doesNotMatch(value, /new ContentAddressedArtifactStore/, file);
    }
  });

  it("keeps every enabled publisher on a concrete hybrid provider or behind E1", async () => {
    const writers = [
      "src/product-compiler/runtime-packet-compiler.ts",
      "src/execution/v3-implementation-attempt.ts",
      "src/findings/v3-github-review-router.ts",
      "src/execution/shadow-attempt-recorder.ts",
    ];
    for (const file of writers) {
      const value = await source(file);
      assert.match(value, /hybrid-required/, file);
      assert.match(value, /createHybridArtifactStoreCapacityLeaseProviderV1/, file);
      assert.match(value, /publicationAuthority/, file);
    }

    assert.match(
      await source("src/execution/activation-preflight.ts"),
      /ARTIFACT_INDEX_AUTHORITY_E1_REQUIRED/,
    );
    assert.match(
      await source("scripts/product-artifact-index.ts"),
      /ARTIFACT_INDEX_AUTHORITY_E1_REQUIRED/,
    );
  });

  it("makes hybrid reads and operational ports capability-checked", async () => {
    const store = await source("src/product-compiler/artifact-store.ts");
    assert.match(store, /hybridAuthorityBackedStores/);
    assert.match(store, /private async getUnleased/);
    assert.match(store, /capacityLeaseProvider\.withLease/);
    assert.doesNotMatch(store, /getWithCapacityAuthority/);

    const reader = await source("src/product-compiler/runtime-artifact-reader.ts");
    assert.match(reader, /allowInitialization: false/);
    assert.match(reader, /publicationAuthority/);

    const operational = await source("src/server/product-build-authority.ts");
    assert.match(operational, /isHybridAuthorityBackedArtifactStore/);
    assert.match(operational, /PRODUCT_BUILD_REFUSAL_ARTIFACT_AUTHORITY_REQUIRED/);
  });
});
