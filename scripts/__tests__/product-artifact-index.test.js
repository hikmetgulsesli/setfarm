import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("product artifact index CLI", () => {
  it("enters the explicit hybrid inventory path instead of the removed E1 refusal", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/product-artifact-index.ts",
        "plan",
        "--database",
        "postgresql://invalid@127.0.0.1:1/never-opened",
        "--root",
        "/tmp/setfarm-artifact-index-e1-required",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          SETFARM_ARTIFACT_STORE_AUTHORITY_V1: "enabled",
        },
      },
    );

    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /ARTIFACT_INDEX_AUTHORITY_E1_REQUIRED/);
    assert.match(result.stderr, /ARTIFACT_INDEX_OPERATION_FAILED|ECONNREFUSED|connect/i);
  });

  it("does not let single-reservation recovery overwrite a quarantined batch result", () => {
    const source = readFileSync(join(root, "scripts", "product-artifact-index.ts"), "utf8");
    const batchRecovery = source.indexOf("recoverExpiredArtifactPublicationBatches");
    const capacityRead = source.indexOf(
      "const afterBatches = await index.getCapacity()",
      batchRecovery,
    );
    const singleRecovery = source.indexOf(
      "recoverExpiredArtifactPublications({ index, store })",
      capacityRead,
    );

    assert.ok(batchRecovery >= 0);
    assert.ok(capacityRead > batchRecovery);
    assert.ok(singleRecovery > capacityRead);
    assert.match(source, /afterBatches\.state === "ready"/);
    assert.match(source, /"skipped_capacity_not_ready"/);
  });
});
