import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("contract spine migration CLI", () => {
  it("rejects a target-release flag without its Git SHA before opening PostgreSQL", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/contract-spine-migrate.ts", "rollback-20-to-19", "--target-release"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--target-release requires a Git SHA/);
  });

  it("requires an exact release target for migration 23 rollback before opening PostgreSQL", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/contract-spine-migrate.ts", "rollback-23-to-22"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback-23-to-22 requires --target-release <git-sha>/);
  });

  it("requires an exact release target for migration 24 rollback before opening PostgreSQL", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/contract-spine-migrate.ts", "rollback-24-to-23"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback-24-to-23 requires --target-release <git-sha>/);
  });
});
