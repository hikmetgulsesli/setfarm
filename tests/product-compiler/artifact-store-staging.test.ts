import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

import { applyContractSpineMigrations } from "../../src/db/contract-spine-migrations.js";
import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import {
  ARTIFACT_STORE_STAGING_DIRECTORY_V1,
  ARTIFACT_STORE_STAGING_MAX_ATTEMPTS_V1,
  ARTIFACT_STORE_STAGING_MAX_FILES_PER_ATTEMPT_V1,
  ArtifactStoreAuthorityError,
  createHybridArtifactStoreCapacityLeaseProviderV1,
} from "../../src/product-compiler/artifact-store-authority.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";

function hashFor(value: number): string {
  return value.toString(16).padStart(64, "0");
}

function tokenFor(value: number): string {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

function attemptName(value: number): string {
  return `${hashFor(value)}.${tokenFor(value)}`;
}

function tempName(value: number): string {
  return `${hashFor(value)}.tmp`;
}

describe("artifact store owned staging authority", () => {
  let database: TestDatabase;
  let sandbox: string;
  let artifactRoot: string;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
    sandbox = await mkdtemp(path.join(tmpdir(), "setfarm-artifact-staging-"));
  });

  after(async () => {
    await rm(sandbox, { recursive: true, force: true });
    await database.cleanup();
  });

  beforeEach(async (context) => {
    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
    await applyContractSpineMigrations(database.sql);
    await createArtifactIndex(database.sql).bootstrap({
      artifacts: [],
      quotaBytes: 64 * 1024 * 1024,
      maxPayloadBytes: 4 * 1024 * 1024,
    });
    artifactRoot = path.join(
      sandbox,
      `${context.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${Date.now()}`,
      "sha256",
    );
    await mkdir(path.dirname(artifactRoot), { recursive: true });
  });

  function provider(options: Readonly<Record<string, unknown>> = {}) {
    return createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      ...options,
    });
  }

  async function initialize(): Promise<void> {
    await provider().withLease(async (lease) => lease.assertCurrent());
  }

  function stagingRoot(): string {
    return path.join(artifactRoot, ARTIFACT_STORE_STAGING_DIRECTORY_V1);
  }

  async function createAttempt(
    attempt: number,
    fileCount: number,
  ): Promise<string> {
    const directory = path.join(stagingRoot(), attemptName(attempt));
    await mkdir(directory, { mode: 0o700 });
    for (let index = 0; index < fileCount; index += 1) {
      await writeFile(
        path.join(directory, tempName(attempt * 32 + index)),
        Buffer.from(`abandoned-${attempt}-${index}`, "utf8"),
        { mode: 0o600 },
      );
    }
    return directory;
  }

  async function expectStagingQuarantine(
    candidate = provider(),
  ): Promise<void> {
    await assert.rejects(
      candidate.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_STAGING_INVALID",
    );
    const rows = await database.sql.unsafe<Array<{
      state: string;
      diagnostic: string | null;
    }>>("SELECT state, diagnostic FROM artifact_store_authorities");
    assert.equal(rows[0]?.state, "quarantined");
    assert.match(rows[0]?.diagnostic ?? "", /ARTIFACT_ROOT_STAGING_INVALID/);
  }

  it("creates private staging only for a verified writer authority", async () => {
    const readOnly = provider({ allowInitialization: false });
    await assert.rejects(
      readOnly.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_CAPACITY_AUTHORITY_NOT_READY",
    );
    await assert.rejects(lstat(artifactRoot), /ENOENT/);

    await initialize();
    const observed = await lstat(stagingRoot());
    assert.equal(observed.isDirectory(), true);
    assert.equal(observed.isSymbolicLink(), false);
    assert.equal(observed.mode & 0o7777, 0o700);
    if (typeof process.getuid === "function") {
      assert.equal(observed.uid, process.getuid());
    }
    await readOnly.withLease(async (lease) => lease.assertCurrent());
    assert.deepEqual(await readdir(stagingRoot()), []);
  });

  it("cleans the exact maximum abandoned tree and preserves final CAS bytes", async () => {
    await initialize();
    const finalHash = hashFor(10_000);
    const finalPath = path.join(artifactRoot, `${finalHash}.json`);
    await writeFile(finalPath, "preserve-final", { mode: 0o600 });
    for (let attempt = 0; attempt < ARTIFACT_STORE_STAGING_MAX_ATTEMPTS_V1; attempt += 1) {
      await createAttempt(
        attempt + 1,
        ARTIFACT_STORE_STAGING_MAX_FILES_PER_ATTEMPT_V1,
      );
    }

    await provider().withLease(async (lease) => lease.assertCurrent());

    assert.deepEqual(await readdir(stagingRoot()), []);
    assert.equal(await readFile(finalPath, "utf8"), "preserve-final");
  });

  it("reconciles one canonical link-before-temp-unlink crash tail", async () => {
    await initialize();
    const bytes = Buffer.from("exact-linked-crash-tail", "utf8");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const attempt = await createAttempt(1, 0);
    const temp = path.join(attempt, `${hash}.tmp`);
    const final = path.join(artifactRoot, `${hash}.json`);
    await writeFile(temp, bytes, { mode: 0o600 });
    await link(temp, final);
    assert.equal((await lstat(temp)).nlink, 2);

    await provider().withLease(async (lease) => lease.assertCurrent());

    await assert.rejects(lstat(temp), /ENOENT/);
    const finalStats = await lstat(final);
    assert.equal(finalStats.nlink, 1);
    assert.equal(await readFile(final, "utf8"), bytes.toString("utf8"));
  });

  it("quarantines an excessive attempt count before deleting authenticated siblings", async () => {
    await initialize();
    for (let attempt = 0; attempt <= ARTIFACT_STORE_STAGING_MAX_ATTEMPTS_V1; attempt += 1) {
      await createAttempt(attempt + 1, 0);
    }
    await expectStagingQuarantine();
    assert.equal(
      (await readdir(stagingRoot())).length,
      ARTIFACT_STORE_STAGING_MAX_ATTEMPTS_V1 + 1,
    );
  });

  it("quarantines excessive files in one attempt without partial cleanup", async () => {
    await initialize();
    const attempt = await createAttempt(
      1,
      ARTIFACT_STORE_STAGING_MAX_FILES_PER_ATTEMPT_V1 + 1,
    );
    await expectStagingQuarantine();
    assert.equal(
      (await readdir(attempt)).length,
      ARTIFACT_STORE_STAGING_MAX_FILES_PER_ATTEMPT_V1 + 1,
    );
  });

  it("rejects an unexpected staging name and leaves a valid sibling untouched", async () => {
    await initialize();
    const valid = await createAttempt(1, 1);
    await mkdir(path.join(stagingRoot(), "not-an-owned-attempt"), { mode: 0o700 });
    await expectStagingQuarantine();
    assert.equal((await readdir(valid)).length, 1);
  });

  it("never follows an attempt-directory symlink", async () => {
    await initialize();
    const outside = path.join(sandbox, `outside-${Date.now()}`);
    await mkdir(outside, { mode: 0o700 });
    const sentinel = path.join(outside, "sentinel");
    await writeFile(sentinel, "preserve", { mode: 0o600 });
    await symlink(outside, path.join(stagingRoot(), attemptName(1)));
    await expectStagingQuarantine();
    assert.equal(await readFile(sentinel, "utf8"), "preserve");
  });

  it("never follows a replacement symlink at the staging root", async () => {
    await initialize();
    const moved = `${stagingRoot()}.moved`;
    await rename(stagingRoot(), moved);
    const sentinel = path.join(moved, "sentinel");
    await writeFile(sentinel, "preserve", { mode: 0o600 });
    await symlink(moved, stagingRoot());
    await expectStagingQuarantine();
    assert.equal(await readFile(sentinel, "utf8"), "preserve");
  });

  it("rejects a nested directory inside an otherwise canonical attempt", async () => {
    await initialize();
    const attempt = await createAttempt(1, 1);
    await mkdir(path.join(attempt, tempName(2)), { mode: 0o700 });
    await expectStagingQuarantine();
    assert.equal((await readdir(attempt)).length, 2);
  });

  it("rejects FIFO and hard-link temp aliases without opening either", async () => {
    await initialize();
    const attempt = await createAttempt(1, 0);
    const fifo = path.join(attempt, tempName(1));
    execFileSync("mkfifo", [fifo]);
    await expectStagingQuarantine();

    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
    await applyContractSpineMigrations(database.sql);
    await createArtifactIndex(database.sql).bootstrap({
      artifacts: [],
      quotaBytes: 64 * 1024 * 1024,
      maxPayloadBytes: 4 * 1024 * 1024,
    });
    artifactRoot = path.join(sandbox, `hard-link-${Date.now()}`, "sha256");
    await mkdir(path.dirname(artifactRoot), { recursive: true });
    await initialize();
    const aliasedAttempt = await createAttempt(1, 1);
    const source = path.join(aliasedAttempt, tempName(32));
    const alias = path.join(sandbox, `external-alias-${Date.now()}`);
    await link(source, alias);
    await expectStagingQuarantine();
    assert.equal(await readFile(alias, "utf8"), "abandoned-1-0");
  });

  it("rejects a Unix socket staging leaf without accepting a cleanup success", {
    skip: process.platform === "win32",
  }, async () => {
    const shortParent = await mkdtemp(path.join(tmpdir(), "sfs-"));
    artifactRoot = path.join(shortParent, "r");
    await initialize();
    // Darwin's sockaddr_un path is shorter than the canonical hash/UUID
    // attempt path. A short root-level socket still proves bounded staging
    // enumeration rejects a special entry without opening or following it.
    const socketPath = path.join(stagingRoot(), "s");
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, resolve);
    });
    try {
      await expectStagingQuarantine();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(shortParent, { recursive: true, force: true });
    }
  });

  it("detects staging replacement after bounded inventory before cleanup", async () => {
    await initialize();
    const attempt = await createAttempt(1, 1);
    const replacement = `${stagingRoot()}.replacement`;
    const failing = provider({
      testHooks: {
        afterStagingInventory: async () => {
          await rename(stagingRoot(), replacement);
          await mkdir(stagingRoot(), { mode: 0o700 });
        },
      },
    });
    await expectStagingQuarantine(failing);
    assert.equal(
      (await readdir(path.join(replacement, path.basename(attempt)))).length,
      1,
    );
  });

  it("reports a staging sync failure as retryable and never as success", async () => {
    await initialize();
    await createAttempt(1, 1);
    const syncFailure = Object.assign(new Error("INJECTED_STAGING_SYNC_FAILURE"), {
      code: "EIO",
    });
    const failing = provider({
      testHooks: {
        beforeStagingSync: () => {
          throw syncFailure;
        },
      },
    });
    await assert.rejects(
      failing.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_UNAVAILABLE",
    );
    const rows = await database.sql.unsafe<Array<{
      state: string;
      diagnostic: string | null;
    }>>("SELECT state, diagnostic FROM artifact_store_authorities");
    assert.deepEqual(Array.from(rows), [{ state: "ready", diagnostic: null }]);
    await provider().withLease(async (lease) => lease.assertCurrent());
    assert.deepEqual(await readdir(stagingRoot()), []);
  });

  it("quarantines an attempt recreated after cleanup but before the sync barrier", async () => {
    await initialize();
    await createAttempt(1, 1);
    const recreatedPath = path.join(stagingRoot(), attemptName(2));
    const failing = provider({
      testHooks: {
        beforeStagingSync: async () => {
          await mkdir(recreatedPath, { mode: 0o700 });
        },
      },
    });
    await expectStagingQuarantine(failing);
    assert.equal((await lstat(recreatedPath)).isDirectory(), true);
  });

  it("rejects private-mode drift before deleting an abandoned temp", async () => {
    await initialize();
    const attempt = await createAttempt(1, 1);
    const target = path.join(attempt, tempName(32));
    await chmod(target, 0o644);
    await expectStagingQuarantine();
    assert.equal(await readFile(target, "utf8"), "abandoned-1-0");
  });
});
