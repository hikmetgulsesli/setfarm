import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
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
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

import { applyContractSpineMigrations } from "../../src/db/contract-spine-migrations.js";
import {
  ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1,
  ARTIFACT_STORE_ROOT_AUTHORITY_SCHEMA_V1,
  ARTIFACT_STORE_KERNEL_LOCK_FILENAME_V1,
  ArtifactStoreAuthorityError,
  artifactStoreAuthorityStagePathV1,
  artifactStoreBindingClaimPathV1,
  artifactStoreRootLocatorHashV1,
  createHybridArtifactStoreCapacityLeaseProviderV1,
  isHybridArtifactStoreCapacityLeaseProviderV1,
} from "../../src/product-compiler/artifact-store-authority.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { createRuntimeArtifactReader } from "../../src/product-compiler/runtime-artifact-reader.js";
import {
  ArtifactStoreError,
  ContentAddressedArtifactStore,
  isHybridAuthorityBackedArtifactStore,
} from "../../src/product-compiler/artifact-store.js";
import {
  IndexedArtifactPublisher,
  IndexedArtifactPublisherError,
} from "../../src/product-compiler/indexed-artifact-publisher.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";

const LOCK_DOMAIN = "setfarm.semantic-artifact-filesystem-publication.v1";

describe("artifact store PostgreSQL/root authority", () => {
  let database: TestDatabase;
  let sandbox: string;
  let artifactRoot: string;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
    sandbox = await mkdtemp(path.join(tmpdir(), "setfarm-artifact-authority-"));
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

  it("commits binding before an exact no-replace marker and returns a branded lease", async () => {
    const events: string[] = [];
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterBindingCommit: ({ authorityId }) => {
          events.push(`binding:${authorityId}`);
        },
        afterMarkerCreate: ({ authorityId }) => {
          events.push(`marker:${authorityId}`);
        },
        afterReadyCommit: ({ authorityId }) => {
          events.push(`ready:${authorityId}`);
        },
      },
    });
    assert.equal(isHybridArtifactStoreCapacityLeaseProviderV1(provider), true);

    const observed = await provider.withLease(async (lease) => {
      assert.equal(
        lease.authority,
        "postgres-transaction+filesystem-kernel-v1",
      );
      assert.equal(lease.signal.aborted, false);
      await lease.assertCurrent();
      return {
        authorityId: lease.authorityId,
        rootLocatorHash: lease.rootLocatorHash,
      };
    });

    assert.deepEqual(events, [
      `binding:${observed.authorityId}`,
      `marker:${observed.authorityId}`,
      `ready:${observed.authorityId}`,
    ]);
    assert.equal(observed.rootLocatorHash, artifactStoreRootLocatorHashV1(artifactRoot));
    const markerBytes = await readFile(
      path.join(artifactRoot, ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1),
    );
    assert.deepEqual(markerBytes, canonicalJsonBytes({
      schema: ARTIFACT_STORE_ROOT_AUTHORITY_SCHEMA_V1,
      authorityId: observed.authorityId,
      rootLocatorHash: observed.rootLocatorHash,
    }));
    const rows = await database.sql.unsafe<Array<{
      authority_id: string;
      root_locator_hash: string;
      state: string;
    }>>(
      `SELECT authority_id::text AS authority_id, root_locator_hash, state
         FROM artifact_store_authorities`,
    );
    assert.deepEqual(Array.from(rows), [{
      authority_id: observed.authorityId,
      root_locator_hash: observed.rootLocatorHash,
      state: "ready",
    }]);
    await assert.rejects(lstat(artifactStoreBindingClaimPathV1(artifactRoot)), /ENOENT/);
  });

  it("refuses an unleased production publisher and routes CAS writes through PostgreSQL", async () => {
    const index = createArtifactIndex(database.sql);
    const standalone = new ContentAddressedArtifactStore(artifactRoot, {
      limits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 64 * 1024 * 1024,
        minFreeBytes: 0,
      },
    });
    assert.throws(
      () => new IndexedArtifactPublisher({
        index,
        store: standalone,
        publicationAuthority: "hybrid-required",
      }),
      (error: unknown) =>
        error instanceof IndexedArtifactPublisherError
        && error.code === "ARTIFACT_PRODUCTION_AUTHORITY_REQUIRED",
    );
    const hostileDuck = {
      put: standalone.put.bind(standalone),
      get: standalone.get.bind(standalone),
      hasHybridCapacityAuthority: () => true,
    };
    assert.throws(
      () => new IndexedArtifactPublisher({
        index,
        store: hostileDuck,
        publicationAuthority: "hybrid-required",
      }),
      (error: unknown) =>
        error instanceof IndexedArtifactPublisherError
        && error.code === "ARTIFACT_PRODUCTION_AUTHORITY_REQUIRED",
    );

    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      limits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 64 * 1024 * 1024,
        minFreeBytes: 0,
      },
      capacityLeaseProvider: provider,
    });
    const publisher = new IndexedArtifactPublisher({
      index,
      store,
      ownerInstanceId: "artifact-authority-integration-test",
      publicationAuthority: "hybrid-required",
    });
    Object.defineProperty(store, "put", {
      configurable: true,
      value: async () => {
        throw new Error("CALLER_REPLACED_STORE_METHOD");
      },
    });
    const published = await publisher.put({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.artifact-authority-test.v1",
      producer: {
        pass: "artifact-authority-test",
        codeSha: "a".repeat(40),
        toolVersions: {},
      },
      payload: { authority: "postgres-transaction+filesystem-kernel-v1" },
    });
    delete (store as unknown as { put?: unknown }).put;
    assert.equal(published.created, true);
    assert.equal(published.indexCreated, true);
    assert.equal(isHybridAuthorityBackedArtifactStore(store), true);
    assert.equal(
      (await readdir(artifactRoot)).includes(`${published.hash}.json`),
      true,
    );
  });

  it("keeps read-only authority checks side-effect free until an initializer is ready", async () => {
    const reader = createRuntimeArtifactReader({
      sql: database.sql,
      artifactRoot,
      artifactLimits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 64 * 1024 * 1024,
        minFreeBytes: 0,
      },
      publicationAuthorityMode: "hybrid-required",
    });
    await assert.rejects(
      reader.store.get("../not-a-hash"),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_INVALID_HASH",
    );
    await assert.rejects(
      reader.store.get("0".repeat(64)),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_CAPACITY_AUTHORITY_NOT_READY",
    );
    assert.deepEqual(
      Array.from(await database.sql.unsafe("SELECT * FROM artifact_store_authorities")),
      [],
    );
    await assert.rejects(lstat(artifactRoot), /ENOENT/);

    const initializer = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await initializer.withLease(async (lease) => lease.assertCurrent());
    await assert.rejects(reader.store.get("0".repeat(64)), /does not exist/);
    assert.equal(reader.publicationAuthority, "hybrid-required");
  });

  it("routes every public read through the held hybrid authority", async () => {
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      capacityLeaseProvider: provider,
    });
    const written = await store.put({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.artifact-authority-read-test.v1",
      producer: {
        pass: "artifact-authority-read-test",
        codeSha: "d".repeat(40),
        toolVersions: {},
      },
      payload: { exact: true },
    });
    await unlink(path.join(
      artifactRoot,
      ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1,
    ));
    await assert.rejects(
      store.get(written.hash),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
    );
  });

  it("never indexes exact legacy bytes from an unmarked root before acquiring authority", async () => {
    const envelope = {
      schema: "setfarm.semantic-artifact-envelope.v1" as const,
      artifactType: "setfarm.artifact-authority-bypass-test.v1",
      producer: {
        pass: "artifact-authority-bypass-test",
        codeSha: "b".repeat(40),
        toolVersions: {},
      },
      payload: { legacy: true },
    };
    const legacyStore = new ContentAddressedArtifactStore(artifactRoot, {
      limits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 64 * 1024 * 1024,
        minFreeBytes: 0,
      },
    });
    const legacy = await legacyStore.put(envelope);
    assert.equal(legacy.created, true);

    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    const productionStore = new ContentAddressedArtifactStore(artifactRoot, {
      limits: legacyStore.limits,
      capacityLeaseProvider: provider,
    });
    const index = createArtifactIndex(database.sql);
    const publisher = new IndexedArtifactPublisher({
      index,
      store: productionStore,
      ownerInstanceId: "artifact-authority-bypass-test",
      publicationAuthority: "hybrid-required",
    });
    await assert.rejects(
      publisher.put(envelope),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_UNMARKED",
    );
    assert.equal(await index.getArtifact(legacy.hash), undefined);
    const authority = await database.sql.unsafe<Array<{ state: string }>>(
      "SELECT state FROM artifact_store_authorities",
    );
    assert.deepEqual(Array.from(authority), [{ state: "quarantined" }]);
  });

  it("does not let an already-indexed replay bypass a missing ready marker", async () => {
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      limits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 64 * 1024 * 1024,
        minFreeBytes: 0,
      },
      capacityLeaseProvider: provider,
    });
    const publisher = new IndexedArtifactPublisher({
      index: createArtifactIndex(database.sql),
      store,
      ownerInstanceId: "already-indexed-authority-test",
      publicationAuthority: "hybrid-required",
    });
    const envelope = {
      schema: "setfarm.semantic-artifact-envelope.v1" as const,
      artifactType: "setfarm.already-indexed-authority-test.v1",
      producer: {
        pass: "already-indexed-authority-test",
        codeSha: "c".repeat(40),
        toolVersions: {},
      },
      payload: { exact: true },
    };
    const first = await publisher.put(envelope);
    assert.equal(first.indexCreated, true);
    await unlink(path.join(
      artifactRoot,
      ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1,
    ));
    await assert.rejects(
      publisher.put(envelope),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
    );
    assert.deepEqual(
      Array.from(await database.sql.unsafe("SELECT state FROM artifact_store_authorities")),
      [{ state: "quarantined" }],
    );
  });

  it("replays one database identity after crashes before marker and before ready", async () => {
    let firstAuthorityId = "";
    const crashBeforeMarker = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterBindingCommit: ({ authorityId }) => {
          firstAuthorityId = authorityId;
          throw new Error("CRASH_AFTER_BINDING_COMMIT");
        },
      },
    });
    await assert.rejects(
      crashBeforeMarker.withLease(async () => undefined),
      /CRASH_AFTER_BINDING_COMMIT/,
    );
    const binding = await database.sql.unsafe<Array<{ authority_id: string; state: string }>>(
      "SELECT authority_id::text AS authority_id, state FROM artifact_store_authorities",
    );
    assert.deepEqual(
      Array.from(binding),
      [{ authority_id: firstAuthorityId, state: "binding" }],
    );

    let markerAuthorityId = "";
    const crashBeforeReady = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterMarkerCreate: ({ authorityId }) => {
          markerAuthorityId = authorityId;
          throw new Error("CRASH_AFTER_MARKER_CREATE");
        },
      },
    });
    await assert.rejects(
      crashBeforeReady.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.cause instanceof Error
        && error.cause.message === "CRASH_AFTER_MARKER_CREATE",
    );
    assert.equal(markerAuthorityId, firstAuthorityId);
    assert.equal((await readdir(artifactRoot)).includes(
      ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1,
    ), true);

    const replay = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    const replayedAuthorityId = await replay.withLease(async (lease) => {
      await lease.assertCurrent();
      return lease.authorityId;
    });
    assert.equal(replayedAuthorityId, firstAuthorityId);
    assert.deepEqual(
      Array.from(await database.sql.unsafe("SELECT state FROM artifact_store_authorities")),
      [{ state: "ready" }],
    );
  });

  it("replays an exact claim plus empty root left by a mkdir-to-marker crash", async () => {
    let authorityId = "";
    const crash = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterRootCreate: (event) => {
          authorityId = event.authorityId;
          throw new Error("CRASH_AFTER_ROOT_CREATE");
        },
      },
    });
    await assert.rejects(
      crash.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.cause instanceof Error
        && error.cause.message === "CRASH_AFTER_ROOT_CREATE",
    );
    assert.deepEqual(await readdir(artifactRoot), []);
    assert.equal((await lstat(artifactStoreBindingClaimPathV1(artifactRoot))).isFile(), true);
    const replay = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    const replayed = await replay.withLease(async (lease) => lease.authorityId);
    assert.equal(replayed, authorityId);
    assert.deepEqual(
      Array.from(await database.sql.unsafe("SELECT state FROM artifact_store_authorities")),
      [{ state: "ready" }],
    );
  });

  it("rejects an externally aliased deterministic marker stage", async () => {
    const crash = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterRootCreate: () => {
          throw new Error("STOP_WITH_EMPTY_BOUND_ROOT");
        },
      },
    });
    await assert.rejects(crash.withLease(async () => undefined), /authority became unavailable/i);
    const rows = await database.sql.unsafe<Array<{
      authority_id: string;
      root_locator_hash: string;
    }>>(
      `SELECT authority_id::text AS authority_id, root_locator_hash
         FROM artifact_store_authorities`,
    );
    const marker = {
      schema: ARTIFACT_STORE_ROOT_AUTHORITY_SCHEMA_V1,
      authorityId: rows[0]!.authority_id,
      rootLocatorHash: rows[0]!.root_locator_hash,
    };
    const markerTarget = path.join(
      artifactRoot,
      ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1,
    );
    const stage = artifactStoreAuthorityStagePathV1(markerTarget, marker);
    const externalAlias = path.join(path.dirname(artifactRoot), "external-marker-alias");
    await writeFile(stage, canonicalJsonBytes(marker), { mode: 0o600, flag: "wx" });
    await link(stage, externalAlias);

    const replay = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await assert.rejects(
      replay.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
    );
    assert.equal((await stat(externalAlias)).nlink, 2);
    assert.deepEqual(
      Array.from(await database.sql.unsafe("SELECT state FROM artifact_store_authorities")),
      [{ state: "quarantined" }],
    );
  });

  it("reconciles an exact target-plus-stage crash alias to one final link", async () => {
    const crash = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterRootCreate: () => {
          throw new Error("STOP_WITH_EMPTY_BOUND_ROOT");
        },
      },
    });
    await assert.rejects(crash.withLease(async () => undefined), /authority became unavailable/i);
    const rows = await database.sql.unsafe<Array<{
      authority_id: string;
      root_locator_hash: string;
    }>>(
      `SELECT authority_id::text AS authority_id, root_locator_hash
         FROM artifact_store_authorities`,
    );
    const marker = {
      schema: ARTIFACT_STORE_ROOT_AUTHORITY_SCHEMA_V1,
      authorityId: rows[0]!.authority_id,
      rootLocatorHash: rows[0]!.root_locator_hash,
    };
    const markerTarget = path.join(
      artifactRoot,
      ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1,
    );
    const stage = artifactStoreAuthorityStagePathV1(markerTarget, marker);
    await writeFile(markerTarget, canonicalJsonBytes(marker), { mode: 0o600, flag: "wx" });
    await link(markerTarget, stage);
    assert.equal((await stat(markerTarget)).nlink, 2);

    const replay = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await replay.withLease(async (lease) => lease.assertCurrent());
    assert.equal((await stat(markerTarget)).nlink, 1);
    await assert.rejects(lstat(stage), /ENOENT/);
    assert.equal(
      (await readdir(artifactRoot)).includes(ARTIFACT_STORE_KERNEL_LOCK_FILENAME_V1),
      true,
    );
  });

  it("rejects foreign content inserted between root creation and binding", async () => {
    const foreign = path.join(artifactRoot, "foreign-before-marker.txt");
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterRootCreate: async () => {
          await writeFile(foreign, "must-not-be-adopted", { mode: 0o600 });
        },
      },
    });
    await assert.rejects(
      provider.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_UNMARKED",
    );
    assert.equal(await readFile(foreign, "utf8"), "must-not-be-adopted");
    assert.deepEqual(
      Array.from(await database.sql.unsafe("SELECT state FROM artifact_store_authorities")),
      [{ state: "quarantined" }],
    );
  });

  it("fails a wrong configured root without mutating either root or database authority", async () => {
    const owner = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await owner.withLease(async (lease) => lease.assertCurrent());
    const before = await database.sql.unsafe<Array<{
      authority_id: string;
      state: string;
      diagnostic: string | null;
    }>>(
      `SELECT authority_id::text AS authority_id, state, diagnostic
         FROM artifact_store_authorities`,
    );
    const wrongRoot = path.join(path.dirname(artifactRoot), "wrong-sha256");
    await mkdir(wrongRoot);
    const foreign = path.join(wrongRoot, "preserve.txt");
    await writeFile(foreign, "preserve-exactly", { mode: 0o600 });
    const wrong = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot: wrongRoot,
    });
    await assert.rejects(
      wrong.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_WRONG_ROOT",
    );
    assert.equal(await readFile(foreign, "utf8"), "preserve-exactly");
    assert.deepEqual(
      Array.from(await database.sql.unsafe(
        `SELECT authority_id::text AS authority_id, state, diagnostic
           FROM artifact_store_authorities`,
      )),
      Array.from(before),
    );
    await assert.rejects(lstat(artifactStoreBindingClaimPathV1(wrongRoot)), /ENOENT/);
  });

  it("never adopts an existing empty unmarked root without the exact binding claim", async () => {
    await mkdir(artifactRoot);
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await assert.rejects(
      provider.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_UNMARKED",
    );
    assert.deepEqual(await readdir(artifactRoot), []);
    const rows = await database.sql.unsafe<Array<{ state: string; diagnostic: string }>>(
      "SELECT state, diagnostic FROM artifact_store_authorities",
    );
    assert.equal(rows[0]?.state, "quarantined");
    assert.match(rows[0]?.diagnostic ?? "", /ARTIFACT_ROOT_AUTHORITY_UNMARKED/);
  });

  it("quarantines a conflicting marker before returning publication authority", async () => {
    let authorityId = "";
    const crash = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterBindingCommit: (event) => {
          authorityId = event.authorityId;
          throw new Error("STOP_BEFORE_FILESYSTEM_BIND");
        },
      },
    });
    await assert.rejects(crash.withLease(async () => undefined), /STOP_BEFORE_FILESYSTEM_BIND/);
    await mkdir(artifactRoot);
    await writeFile(
      path.join(artifactRoot, ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1),
      canonicalJsonBytes({
        schema: ARTIFACT_STORE_ROOT_AUTHORITY_SCHEMA_V1,
        authorityId: "22222222-2222-4222-8222-222222222222",
        rootLocatorHash: artifactStoreRootLocatorHashV1(artifactRoot),
      }),
      { mode: 0o600 },
    );

    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await assert.rejects(
      provider.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
    );
    const rows = await database.sql.unsafe<Array<{
      authority_id: string;
      state: string;
      diagnostic: string;
    }>>(
      "SELECT authority_id::text AS authority_id, state, diagnostic FROM artifact_store_authorities",
    );
    assert.equal(rows[0]?.authority_id, authorityId);
    assert.equal(rows[0]?.state, "quarantined");
    assert.match(rows[0]?.diagnostic ?? "", /ARTIFACT_ROOT_AUTHORITY_CONFLICT/);
  });

  it("detects exact-byte marker replacement by physical identity during a lease", async () => {
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await provider.withLease(async (lease) => lease.assertCurrent());
    const marker = path.join(
      artifactRoot,
      ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1,
    );
    const exactBytes = await readFile(marker);
    const replaced = path.join(artifactRoot, "replaced-authority-marker.json");
    await assert.rejects(
      provider.withLease(async (lease) => {
        await rename(marker, replaced);
        await writeFile(marker, exactBytes, { mode: 0o600, flag: "wx" });
        await lease.assertCurrent();
      }),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
    );
    assert.deepEqual(
      Array.from(await database.sql.unsafe("SELECT state FROM artifact_store_authorities")),
      [{ state: "quarantined" }],
    );
  });

  it("preserves caller-forged authority errors without quarantining healthy authority", async () => {
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await provider.withLease(async (lease) => lease.assertCurrent());
    const forged = new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "CALLER_FORGED_AUTHORITY_ERROR",
    );
    await assert.rejects(
      provider.withLease(async () => {
        throw forged;
      }),
      (error: unknown) => error === forged,
    );
    assert.deepEqual(
      Array.from(await database.sql.unsafe(
        "SELECT state, diagnostic FROM artifact_store_authorities",
      )),
      [{ state: "ready", diagnostic: null }],
    );
  });

  it("quarantines a ready authority whose marker disappears before work", async () => {
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await provider.withLease(async (lease) => lease.assertCurrent());
    await unlink(path.join(
      artifactRoot,
      ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1,
    ));
    await assert.rejects(
      provider.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
    );
    assert.deepEqual(
      Array.from(await database.sql.unsafe("SELECT state FROM artifact_store_authorities")),
      [{ state: "quarantined" }],
    );
  });

  it("keeps transient filesystem observation failures retryable and unquarantined", async () => {
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await provider.withLease(async (lease) => lease.assertCurrent());
    await chmod(artifactRoot, 0o000);
    try {
      await assert.rejects(
        provider.withLease(async () => undefined),
        (error: unknown) =>
          error instanceof ArtifactStoreAuthorityError
          && error.code === "ARTIFACT_ROOT_AUTHORITY_UNAVAILABLE",
      );
      assert.deepEqual(
        Array.from(await database.sql.unsafe(
          "SELECT state, diagnostic FROM artifact_store_authorities",
        )),
        [{ state: "ready", diagnostic: null }],
      );
    } finally {
      await chmod(artifactRoot, 0o700);
    }
    await provider.withLease(async (lease) => lease.assertCurrent());
  });

  it("cleans the exact temporary claim after a crash following ready commit", async () => {
    const crash = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterReadyCommit: () => {
          throw new Error("CRASH_AFTER_READY_COMMIT");
        },
      },
    });
    await assert.rejects(
      crash.withLease(async () => undefined),
      /CRASH_AFTER_READY_COMMIT/,
    );
    assert.deepEqual(
      Array.from(await database.sql.unsafe("SELECT state FROM artifact_store_authorities")),
      [{ state: "ready" }],
    );
    assert.equal((await lstat(artifactStoreBindingClaimPathV1(artifactRoot))).isFile(), true);

    const replay = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await replay.withLease(async (lease) => lease.assertCurrent());
    await assert.rejects(lstat(artifactStoreBindingClaimPathV1(artifactRoot)), /ENOENT/);
  });

  it("waits for every owned kernel helper to exit before returning", async () => {
    const acquired: number[] = [];
    const released: number[] = [];
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        afterKernelLockAcquired: ({ pid }) => {
          acquired.push(pid);
        },
        afterKernelLockReleased: ({ pid }) => {
          released.push(pid);
        },
      },
    });
    await provider.withLease(async (lease) => lease.assertCurrent());
    assert.deepEqual(released, acquired);
    assert.equal(acquired.length >= 2, true);
    for (const pid of acquired) {
      assert.throws(
        () => process.kill(pid, 0),
        (error: unknown) =>
          error instanceof Error
          && "code" in error
          && error.code === "ESRCH",
      );
    }
  });

  it("kills a ready helper when acquisition fails before the parent FD closes", async () => {
    const healthy = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await healthy.withLease(async (lease) => lease.assertCurrent());

    let helperPid: number | undefined;
    const failing = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      testHooks: {
        beforeKernelParentHandleClose: ({ pid }) => {
          helperPid = pid;
          throw new Error("INJECTED_PARENT_FD_CLOSE_FAILURE");
        },
      },
    });
    await assert.rejects(
      failing.withLease(async () => undefined),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_CAPACITY_AUTHORITY_LOST"
        && error.cause instanceof Error
        && error.cause.message === "INJECTED_PARENT_FD_CLOSE_FAILURE",
    );
    assert.notEqual(helperPid, undefined);
    assert.throws(
      () => process.kill(helperPid!, 0),
      (error: unknown) =>
        error instanceof Error
        && "code" in error
        && error.code === "ESRCH",
    );
    assert.deepEqual(
      Array.from(await database.sql.unsafe(
        "SELECT state, diagnostic FROM artifact_store_authorities",
      )),
      [{ state: "ready", diagnostic: null }],
    );
    await healthy.withLease(async (lease) => lease.assertCurrent());
  });

  it("serializes same-database contenders on the transaction advisory lease", async () => {
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      lockTimeoutMs: 2_000,
    });
    await provider.withLease(async (lease) => lease.assertCurrent());
    let active = 0;
    let maximumActive = 0;
    let releaseFirst!: () => void;
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      firstEntered = resolve;
    });
    const first = provider.withLease(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      firstEntered();
      await firstHeld;
      active -= 1;
    });
    await entered;
    let secondEntered = false;
    const second = provider.withLease(async () => {
      secondEntered = true;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      active -= 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(secondEntered, false);
    releaseFirst();
    await Promise.all([first, second]);
    assert.equal(maximumActive, 1);
  });

  it("serializes cloned databases that share the same ready authority and physical root", async () => {
    const firstProvider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      lockTimeoutMs: 2_000,
    });
    await firstProvider.withLease(async (lease) => lease.assertCurrent());
    const authority = await database.sql.unsafe<Array<{
      authority_key: string;
      authority_schema: string;
      authority_id: string;
      root_locator_hash: string;
      state: string;
      diagnostic: string | null;
    }>>(
      `SELECT authority_key, authority_schema,
              authority_id::text AS authority_id,
              root_locator_hash, state, diagnostic
         FROM artifact_store_authorities`,
    );
    const secondDatabase = await createIsolatedTestDatabase({ migrate: false });
    try {
      await applyContractSpineMigrations(secondDatabase.sql);
      await createArtifactIndex(secondDatabase.sql).bootstrap({
        artifacts: [],
        quotaBytes: 64 * 1024 * 1024,
        maxPayloadBytes: 4 * 1024 * 1024,
      });
      const copied = authority[0]!;
      await secondDatabase.sql.unsafe(
        `INSERT INTO artifact_store_authorities (
           authority_key, authority_schema, authority_id,
           root_locator_hash, state, diagnostic
         ) VALUES ($1, $2, $3, $4, 'binding', NULL)`,
        [
          copied.authority_key,
          copied.authority_schema,
          copied.authority_id,
          copied.root_locator_hash,
        ],
      );
      await secondDatabase.sql.unsafe(
        `UPDATE artifact_store_authorities
            SET state = 'ready', diagnostic = NULL
          WHERE authority_key = $1`,
        [copied.authority_key],
      );
      const cloneProvider = createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: secondDatabase.sql,
        artifactRoot,
        lockTimeoutMs: 2_000,
      });
      let active = 0;
      let maximumActive = 0;
      let releaseFirst!: () => void;
      const firstHeld = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      let enteredFirst!: () => void;
      const firstEntered = new Promise<void>((resolve) => {
        enteredFirst = resolve;
      });
      const first = firstProvider.withLease(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        enteredFirst();
        await firstHeld;
        active -= 1;
      });
      await firstEntered;
      let cloneEntered = false;
      const clone = cloneProvider.withLease(async () => {
        cloneEntered = true;
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        active -= 1;
      });
      await new Promise((resolve) => setTimeout(resolve, 75));
      assert.equal(cloneEntered, false);
      releaseFirst();
      await Promise.all([first, clone]);
      assert.equal(maximumActive, 1);
      assert.deepEqual(
        Array.from(await secondDatabase.sql.unsafe(
          "SELECT state FROM artifact_store_authorities",
        )),
        [{ state: "ready" }],
      );
    } finally {
      await secondDatabase.cleanup();
    }
  });

  it("gives two databases racing for one root one marker winner and one quarantine", async () => {
    const secondDatabase = await createIsolatedTestDatabase({ migrate: false });
    try {
      await applyContractSpineMigrations(secondDatabase.sql);
      await createArtifactIndex(secondDatabase.sql).bootstrap({
        artifacts: [],
        quotaBytes: 64 * 1024 * 1024,
        maxPayloadBytes: 4 * 1024 * 1024,
      });
      let bindings = 0;
      let releaseBindings!: () => void;
      const bothBound = new Promise<void>((resolve) => {
        releaseBindings = resolve;
      });
      const afterBindingCommit = async () => {
        bindings += 1;
        if (bindings === 2) releaseBindings();
        await bothBound;
      };
      const first = createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: database.sql,
        artifactRoot,
        testHooks: { afterBindingCommit },
      });
      const second = createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: secondDatabase.sql,
        artifactRoot,
        testHooks: { afterBindingCommit },
      });
      const results = await Promise.allSettled([
        first.withLease(async (lease) => lease.authorityId),
        second.withLease(async (lease) => lease.authorityId),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 1);
      const rejected = results.find((result) => result.status === "rejected");
      assert.equal(
        rejected?.status === "rejected"
          && rejected.reason instanceof ArtifactStoreAuthorityError
          && rejected.reason.code === "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
        true,
        rejected?.status === "rejected"
          ? `${rejected.reason?.name}:${rejected.reason?.code}:${rejected.reason?.message}`
          : "no rejected result",
      );
      const firstRows = await database.sql.unsafe<Array<{ authority_id: string; state: string }>>(
        "SELECT authority_id::text AS authority_id, state FROM artifact_store_authorities",
      );
      const secondRows = await secondDatabase.sql.unsafe<Array<{
        authority_id: string;
        state: string;
      }>>(
        "SELECT authority_id::text AS authority_id, state FROM artifact_store_authorities",
      );
      assert.deepEqual(
        [firstRows[0]?.state, secondRows[0]?.state].sort(),
        ["quarantined", "ready"],
      );
      const marker = JSON.parse((await readFile(
        path.join(artifactRoot, ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1),
        "utf8",
      ))) as { authorityId: string };
      const winner = firstRows[0]?.state === "ready" ? firstRows[0] : secondRows[0];
      assert.equal(marker.authorityId, winner?.authority_id);
    } finally {
      await secondDatabase.cleanup();
    }
  });

  it("loses the lease when its database connection dies and reacquires after release", async () => {
    const initializer = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await initializer.withLease(async (lease) => lease.assertCurrent());
    const childSource = `
      import postgres from "postgres";
      import { createHybridArtifactStoreCapacityLeaseProviderV1 } from
        "./src/product-compiler/artifact-store-authority.ts";
      const sql = postgres(process.env.SETFARM_TEST_DB_URL, {
        max: 1, connect_timeout: 5, idle_timeout: 1, onnotice: () => {}
      });
      const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
        sql, artifactRoot: process.env.SETFARM_TEST_ARTIFACT_ROOT
      });
      try {
        await provider.withLease(async (lease) => {
          process.stdout.write("LEASE_READY\\n");
          while (true) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            await lease.assertCurrent();
          }
        });
      } catch (error) {
        process.stderr.write(String(error?.code ?? error?.message ?? error) + "\\n");
        process.exitCode = 71;
      } finally {
        await sql.end({ timeout: 1 }).catch(() => undefined);
      }
    `;
    const victim = spawn(
      process.execPath,
      ["--input-type=module", "--import", "tsx", "-e", childSource],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SETFARM_TEST_DB_URL: database.url,
          SETFARM_TEST_ARTIFACT_ROOT: artifactRoot,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let victimOutput = "";
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("victim lease readiness timeout")), 5_000);
      victim.once("error", reject);
      victim.stdout.on("data", (chunk: Buffer) => {
        victimOutput += chunk.toString("utf8");
        if (victimOutput.includes("LEASE_READY\n")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    try {
      const holders = await database.sql.unsafe<Array<{ pid: number }>>(
            `SELECT DISTINCT a.pid
               FROM pg_stat_activity a
               JOIN pg_locks l
                 ON l.pid = a.pid
                AND l.locktype = 'advisory'
                AND l.granted
              WHERE a.datname = current_database()
                AND a.pid <> pg_backend_pid()
                AND a.state = 'idle in transaction'
              ORDER BY a.pid`,
      );
      assert.equal(holders.length, 1);
      const terminated = await database.sql.unsafe<Array<{ terminated: boolean }>>(
        "SELECT pg_terminate_backend($1) AS terminated",
        [holders[0]!.pid],
      );
      assert.equal(terminated[0]?.terminated, true);
      const [code] = await Promise.race([
        once(victim, "exit") as Promise<[number | null, NodeJS.Signals | null]>,
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("victim process did not exit after connection death")),
          5_000,
        )),
      ]);
      assert.notEqual(code, null);
    } finally {
      if (victim.exitCode === null && victim.signalCode === null) victim.kill("SIGKILL");
    }
    const reacquireProvider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    const reacquired = await reacquireProvider.withLease(async (lease) => {
      await lease.assertCurrent();
      return lease.authorityId;
    });
    assert.match(reacquired, /^[0-9a-f-]{36}$/);
  });

  it("enforces bounded lock acquisition and work abort deadlines", async () => {
    const initializer = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
    });
    await initializer.withLease(async (lease) => lease.assertCurrent());
    const lockTimeoutProvider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      lockTimeoutMs: 40,
      workTimeoutMs: 1_000,
    });

    let releaseExternal!: () => void;
    const holdExternal = new Promise<void>((resolve) => {
      releaseExternal = resolve;
    });
    let externalEntered!: () => void;
    const externalEntry = new Promise<void>((resolve) => {
      externalEntered = resolve;
    });
    const external = database.sql.begin(async (transaction) => {
      await transaction.unsafe(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [LOCK_DOMAIN],
      );
      externalEntered();
      await holdExternal;
    });
    await externalEntry;
    try {
      await assert.rejects(
        lockTimeoutProvider.withLease(async () => undefined),
        (error: unknown) =>
          error instanceof ArtifactStoreAuthorityError
          && error.code === "ARTIFACT_CAPACITY_AUTHORITY_LOCK_TIMEOUT",
      );
    } finally {
      releaseExternal();
      await external;
    }

    const workTimeoutProvider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      lockTimeoutMs: 1_000,
      workTimeoutMs: 40,
    });
    await assert.rejects(
      workTimeoutProvider.withLease(async (lease) => {
        await once(lease.signal, "abort");
        await lease.assertCurrent();
      }),
      (error: unknown) =>
        error instanceof ArtifactStoreAuthorityError
        && error.code === "ARTIFACT_CAPACITY_AUTHORITY_WORK_TIMEOUT",
    );
  });
});
