import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  ArtifactCapacityError,
  assessArtifactCapacity,
  assessArtifactBatchCapacity,
  resolveArtifactCapacityVolumeDirectory,
} from "../../src/product-compiler/artifact-capacity.js";
import {
  ContentAddressedArtifactStore,
} from "../../src/product-compiler/artifact-store.js";
import { resolveProductArtifactCapacity } from "../../src/runtime-config.js";

const roots: string[] = [];

function envelope(id: string, payload = "small") {
  return {
    schema: "setfarm.semantic-artifact-envelope.v1" as const,
    artifactType: "setfarm.capacity-test.v1",
    producer: {
      pass: "artifact-capacity-test",
      codeSha: "a".repeat(40),
      toolVersions: {},
    },
    payload: { id, payload },
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("artifact capacity admission", () => {
  it("measures the target volume when the configured root is a directory symlink", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-symlink-"));
    roots.push(parent);
    const target = path.join(parent, "target");
    const linkedRoot = path.join(parent, "linked-root");
    await symlink(target, linkedRoot, "dir");

    // A dangling target is skipped while finding the closest existing volume.
    assert.equal(await resolveArtifactCapacityVolumeDirectory(linkedRoot), parent);

    await mkdir(target);
    assert.equal(await resolveArtifactCapacityVolumeDirectory(linkedRoot), path.resolve(linkedRoot));
  });

  it("uses bounded production defaults and rejects malformed environment limits", () => {
    assert.deepEqual(resolveProductArtifactCapacity({}), {
      maxPayloadBytes: 4 * 1024 * 1024,
      rootQuotaBytes: 512 * 1024 * 1024,
      minFreeBytes: 1024 * 1024 * 1024,
    });
    assert.deepEqual(resolveProductArtifactCapacity({
      SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES: "100",
      SETFARM_ARTIFACT_ROOT_QUOTA_BYTES: "1000",
      SETFARM_ARTIFACT_MIN_FREE_BYTES: "10",
    }), {
      maxPayloadBytes: 100,
      rootQuotaBytes: 1_000,
      minFreeBytes: 10,
    });
    assert.throws(
      () => resolveProductArtifactCapacity({ SETFARM_ARTIFACT_ROOT_QUOTA_BYTES: "1GB" }),
      /SETFARM_ARTIFACT_ROOT_QUOTA_BYTES_INVALID/,
    );
  });

  it("classifies payload, root quota, and free-space failures distinctly", () => {
    assert.equal(assessArtifactCapacity({
      payloadBytes: 101,
      rootBytes: 0,
      freeBytes: 10_000,
      limits: { maxPayloadBytes: 100, rootQuotaBytes: 1_000, minFreeBytes: 10 },
    }).code, "ARTIFACT_PAYLOAD_TOO_LARGE");
    assert.equal(assessArtifactCapacity({
      payloadBytes: 200,
      rootBytes: 900,
      freeBytes: 10_000,
      limits: { maxPayloadBytes: 500, rootQuotaBytes: 1_000, minFreeBytes: 10 },
    }).code, "ARTIFACT_ROOT_QUOTA_EXCEEDED");
    assert.equal(assessArtifactCapacity({
      payloadBytes: 200,
      rootBytes: 0,
      freeBytes: 205,
      limits: { maxPayloadBytes: 500, rootQuotaBytes: 1_000, minFreeBytes: 10 },
    }).code, "ARTIFACT_FREE_SPACE_LOW");
  });

  it("assesses aggregate missing bytes while preserving per-item payload limits", () => {
    const limits = { maxPayloadBytes: 100, rootQuotaBytes: 1_000, minFreeBytes: 100 };
    const aggregate = assessArtifactBatchCapacity({
      missingPayloadByteLengths: [60, 60],
      rootBytes: 700,
      freeBytes: 1_000,
      limits,
    });
    assert.equal(aggregate.status, "pass");
    assert.equal(aggregate.code, "ARTIFACT_CAPACITY_OK");
    assert.equal(aggregate.payloadBytes, 120);
    assert.equal(aggregate.projectedRootBytes, 820);
    assert.equal(aggregate.projectedFreeBytes, 880);

    assert.equal(assessArtifactBatchCapacity({
      missingPayloadByteLengths: [101, 1],
      rootBytes: 0,
      freeBytes: 10_000,
      limits,
    }).code, "ARTIFACT_PAYLOAD_TOO_LARGE");
  });

  it("rejects aggregate or projected-root arithmetic authority loss", () => {
    const limits = {
      maxPayloadBytes: Number.MAX_SAFE_INTEGER,
      rootQuotaBytes: Number.MAX_SAFE_INTEGER,
      minFreeBytes: 0,
    };
    for (const input of [
      {
        missingPayloadByteLengths: [Number.MAX_SAFE_INTEGER, 1],
        rootBytes: 0,
      },
      {
        missingPayloadByteLengths: [1],
        rootBytes: Number.MAX_SAFE_INTEGER,
      },
    ]) {
      assert.throws(
        () => assessArtifactBatchCapacity({
          ...input,
          freeBytes: Number.MAX_SAFE_INTEGER,
          limits,
        }),
        (error: unknown) =>
          error instanceof ArtifactCapacityError
          && error.code === "ARTIFACT_BATCH_CAPACITY_OVERFLOW",
      );
    }
  });

  it("snapshots at most nine dense byte lengths without invoking caller traps", () => {
    const base = {
      rootBytes: 0,
      freeBytes: 10_000,
      limits: { maxPayloadBytes: 1_000, rootQuotaBytes: 10_000, minFreeBytes: 0 },
    };
    let traps = 0;
    const proxied = new Proxy([1], {
      getPrototypeOf() {
        traps += 1;
        throw new Error("length prototype trap");
      },
      ownKeys() {
        traps += 1;
        throw new Error("length keys trap");
      },
    });
    assert.throws(
      () => assessArtifactBatchCapacity({ ...base, missingPayloadByteLengths: proxied }),
      TypeError,
    );
    assert.equal(traps, 0);

    let getterCalls = 0;
    const accessor = Object.defineProperty([], "0", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 1;
      },
    });
    assert.throws(
      () => assessArtifactBatchCapacity({ ...base, missingPayloadByteLengths: accessor }),
      TypeError,
    );
    assert.equal(getterCalls, 0);

    const sparse = new Array(2);
    sparse[1] = 1;
    for (const lengths of [
      sparse,
      Array.from({ length: 10 }, () => 1),
      [1, -1],
      [1, 1.5],
    ]) {
      assert.throws(
        () => assessArtifactBatchCapacity({
          ...base,
          missingPayloadByteLengths: lengths,
        }),
        TypeError,
      );
    }
  });

  it("keeps aggregate quota, free-space, and exact-existing accounting distinct", () => {
    const limits = { maxPayloadBytes: 500, rootQuotaBytes: 1_000, minFreeBytes: 100 };
    assert.equal(assessArtifactBatchCapacity({
      missingPayloadByteLengths: [200, 300],
      rootBytes: 600,
      freeBytes: 10_000,
      limits,
    }).code, "ARTIFACT_ROOT_QUOTA_EXCEEDED");
    assert.equal(assessArtifactBatchCapacity({
      missingPayloadByteLengths: [200, 300],
      rootBytes: 0,
      freeBytes: 550,
      limits,
    }).code, "ARTIFACT_FREE_SPACE_LOW");
    const exactExisting = assessArtifactBatchCapacity({
      missingPayloadByteLengths: [0, 100, 0],
      rootBytes: 800,
      freeBytes: 1_000,
      limits,
    });
    assert.equal(exactExisting.status, "pass");
    assert.equal(exactExisting.payloadBytes, 100);
    assert.equal(exactExisting.projectedRootBytes, 900);

    const allExactExisting = assessArtifactBatchCapacity({
      missingPayloadByteLengths: [],
      rootBytes: limits.rootQuotaBytes,
      freeBytes: 0,
      limits,
    });
    assert.equal(allExactExisting.status, "pass");
    assert.equal(allExactExisting.code, "ARTIFACT_CAPACITY_OK");
    assert.equal(allExactExisting.payloadBytes, 0);
  });

  it("rejects an oversized canonical envelope before creating a root or temp file", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-payload-"));
    roots.push(parent);
    const root = path.join(parent, "missing", "sha256");
    const store = new ContentAddressedArtifactStore(root, {
      limits: { maxPayloadBytes: 256, rootQuotaBytes: 10_000, minFreeBytes: 0 },
      measure: async () => ({ rootBytes: 0, freeBytes: 10_000 }),
    });
    await assert.rejects(
      store.put(envelope("oversized", "x".repeat(8 * 1024 * 1024))),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_PAYLOAD_TOO_LARGE",
    );
    assert.deepEqual(await readdir(parent), []);
  });

  it("maps deep canonical traversal to payload capacity before creating the root", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-depth-"));
    roots.push(parent);
    const root = path.join(parent, "missing", "sha256");
    const store = new ContentAddressedArtifactStore(root, {
      limits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 16 * 1024 * 1024,
        minFreeBytes: 0,
      },
    });
    let deep: unknown = null;
    for (let index = 0; index < 130; index += 1) deep = { child: deep };

    await assert.rejects(
      store.put({ ...envelope("deep"), payload: deep }),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_PAYLOAD_TOO_LARGE",
    );
    assert.deepEqual(await readdir(parent), []);
  });

  it("maps high-container and high-node canonical work to payload capacity", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-shape-"));
    roots.push(parent);
    const root = path.join(parent, "missing", "sha256");
    const store = new ContentAddressedArtifactStore(root, {
      limits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 16 * 1024 * 1024,
        minFreeBytes: 0,
      },
    });
    const tooManyEntries = Array.from({ length: 100_001 }, () => null);
    const tooManyNodes = Array.from(
      { length: 501 },
      () => Array.from({ length: 500 }, () => null),
    );

    for (const [id, payload] of [
      ["container", tooManyEntries],
      ["nodes", tooManyNodes],
    ] as const) {
      await assert.rejects(
        store.put({ ...envelope(id), payload }),
        (error: unknown) =>
          error instanceof ArtifactCapacityError
          && error.code === "ARTIFACT_PAYLOAD_TOO_LARGE",
      );
    }
    assert.deepEqual(await readdir(parent), []);
  });

  it("bounds producer toolVersions before schema traversal or root creation", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-producer-"));
    roots.push(parent);
    const root = path.join(parent, "missing", "sha256");
    const store = new ContentAddressedArtifactStore(root, {
      limits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 16 * 1024 * 1024,
        minFreeBytes: 0,
      },
    });
    const toolVersions: Record<string, unknown> = {};
    for (let index = 0; index < 100_001; index += 1) {
      toolVersions[`tool-${index}`] = "1";
    }
    // If schema traversal happens first this fails immediately as a Zod type
    // error. The container authority must win before Zod sees the snapshot.
    toolVersions["tool-0"] = 0;

    await assert.rejects(
      store.put({
        ...envelope("hostile-producer"),
        producer: {
          ...envelope("hostile-producer").producer,
          toolVersions,
        },
      }),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_PAYLOAD_TOO_LARGE",
    );
    assert.deepEqual(await readdir(parent), []);
  });

  it("reuses an existing identical artifact without allocating at quota", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-reuse-"));
    roots.push(root);
    let capacity = { rootBytes: 0, freeBytes: 10_000 };
    let measurements = 0;
    const store = new ContentAddressedArtifactStore(root, {
      limits: { maxPayloadBytes: 10_000, rootQuotaBytes: 10_000, minFreeBytes: 10 },
      measure: async () => {
        measurements += 1;
        return capacity;
      },
    });
    const first = await store.put(envelope("same"));
    capacity = { rootBytes: 10_000, freeBytes: 0 };
    const beforeReuse = measurements;
    const reused = await store.put(envelope("same"));
    assert.equal(first.created, true);
    assert.equal(reused.created, false);
    assert.equal(measurements, beforeReuse);
  });

  it("propagates store quota and free-space failures as distinct codes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-codes-"));
    roots.push(root);
    const limits = { maxPayloadBytes: 10_000, rootQuotaBytes: 10_000, minFreeBytes: 1_000 };
    const quotaStore = new ContentAddressedArtifactStore(root, {
      limits,
      measure: async () => ({ rootBytes: 9_999, freeBytes: 100_000 }),
    });
    await assert.rejects(
      quotaStore.put(envelope("quota")),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_ROOT_QUOTA_EXCEEDED",
    );
    const freeStore = new ContentAddressedArtifactStore(root, {
      limits,
      measure: async () => ({ rootBytes: 0, freeBytes: 1_000 }),
    });
    await assert.rejects(
      freeStore.put(envelope("free")),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_FREE_SPACE_LOW",
    );
  });

  it("serializes different writers so a quota race admits at most one", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-race-"));
    roots.push(root);
    const probe = new ContentAddressedArtifactStore(root, {
      limits: { maxPayloadBytes: 10_000, rootQuotaBytes: 10_000, minFreeBytes: 0 },
    });
    const first = await probe.put(envelope("probe", "x".repeat(300)));
    const firstBytes = (await probe.get(first.hash)).bytes.length;
    await rm(root, { recursive: true, force: true });

    const store = new ContentAddressedArtifactStore(root, {
      limits: {
        maxPayloadBytes: 10_000,
        rootQuotaBytes: firstBytes + 24,
        minFreeBytes: 0,
      },
    });
    const results = await Promise.allSettled([
      store.put(envelope("one", "x".repeat(300))),
      store.put(envelope("two", "x".repeat(300))),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.equal(rejected.reason?.code, "ARTIFACT_ROOT_QUOTA_EXCEEDED");
    assert.equal((await readdir(root)).filter((name) => name.endsWith(".json")).length, 1);
  });

  it("fails closed on an abandoned-looking capacity lock instead of breaking exclusivity", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-lock-"));
    roots.push(root);
    const lock = path.join(root, ".capacity.lock");
    await writeFile(lock, "unknown-owner", { mode: 0o600 });
    await utimes(lock, new Date(0), new Date(0));
    const store = new ContentAddressedArtifactStore(root, {
      limits: { maxPayloadBytes: 10_000, rootQuotaBytes: 10_000, minFreeBytes: 0 },
      measure: async () => ({ rootBytes: 0, freeBytes: 10_000 }),
      lockTimeoutMs: 25,
    });
    await assert.rejects(
      store.put(envelope("locked")),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_CAPACITY_LOCK_TIMEOUT",
    );
    await access(lock);
  });
});
