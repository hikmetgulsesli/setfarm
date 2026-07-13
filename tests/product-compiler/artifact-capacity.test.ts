import assert from "node:assert/strict";
import { access, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  ArtifactCapacityError,
  assessArtifactCapacity,
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

  it("rejects an oversized canonical envelope before creating a root or temp file", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "setfarm-capacity-payload-"));
    roots.push(parent);
    const root = path.join(parent, "missing", "sha256");
    const store = new ContentAddressedArtifactStore(root, {
      limits: { maxPayloadBytes: 256, rootQuotaBytes: 10_000, minFreeBytes: 0 },
      measure: async () => ({ rootBytes: 0, freeBytes: 10_000 }),
    });
    await assert.rejects(
      store.put(envelope("oversized", "x".repeat(2_000))),
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
