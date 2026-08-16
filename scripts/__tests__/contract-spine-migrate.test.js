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

  it("requires an exact release target for migration 26 rollback before opening PostgreSQL", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/contract-spine-migrate.ts", "rollback-26-to-25"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback-26-to-25 requires --target-release <git-sha>/);
  });

  it("requires an exact release target for migration 27 rollback before opening PostgreSQL", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/contract-spine-migrate.ts", "rollback-27-to-26"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback-27-to-26 requires --target-release <git-sha>/);
  });

  it("requires an exact release target for migration 28 rollback before opening PostgreSQL", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/contract-spine-migrate.ts", "rollback-28-to-27"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback-28-to-27 requires --target-release <git-sha>/);
  });

  it("requires an exact release target for migration 29 rollback before opening PostgreSQL", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/contract-spine-migrate.ts", "rollback-29-to-28"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback-29-to-28 requires --target-release <git-sha>/);
  });

  it("requires an exact release target for migration 30 rollback before opening PostgreSQL", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/contract-spine-migrate.ts", "rollback-30-to-29"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback-30-to-29 requires --target-release <git-sha>/);
  });

  it("requires an exact release target for migration 31 rollback before opening PostgreSQL", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/contract-spine-migrate.ts", "rollback-31-to-30"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback-31-to-30 requires --target-release <git-sha>/);
  });
});
