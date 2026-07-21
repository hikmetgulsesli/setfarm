import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("product artifact index CLI", () => {
  it("refuses standalone inventory and recovery before opening PostgreSQL in hybrid mode", () => {
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
    assert.match(result.stderr, /ARTIFACT_INDEX_AUTHORITY_E1_REQUIRED/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED/);
  });
});
