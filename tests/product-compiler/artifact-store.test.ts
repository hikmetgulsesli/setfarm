import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  ArtifactStoreError,
  ContentAddressedArtifactStore,
  SemanticArtifactEnvelopeV1Schema,
} from "../../src/product-compiler/artifact-store.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";

function envelope() {
  return {
    schema: "setfarm.semantic-artifact-envelope.v1" as const,
    artifactType: "setfarm.test-contract.v1",
    producer: {
      pass: "artifact-store-test",
      codeSha: "5840ae3",
      toolVersions: { node: process.versions.node },
    },
    payload: {
      zeta: "last input key",
      alpha: "first canonical key",
    },
  };
}

describe("content-addressed artifact store", () => {
  let tempRoot = "";
  let artifactRoot = "";

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "setfarm-artifact-store-"));
    artifactRoot = path.join(tempRoot, "nested", "sha256");
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("does not create its injected root until the first write", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    await assert.rejects(stat(artifactRoot), { code: "ENOENT" });
    await store.put(envelope());
    assert.equal((await stat(artifactRoot)).isDirectory(), true);
  });

  it("stores exact canonical bytes at the SHA-256 path", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const value = envelope();
    const expectedBytes = canonicalJsonBytes(value);
    const expectedHash = createHash("sha256").update(expectedBytes).digest("hex");

    const result = await store.put(value);

    assert.equal(result.hash, expectedHash);
    assert.equal(result.path, path.join(artifactRoot, `${expectedHash}.json`));
    assert.equal(result.created, true);
    assert.deepEqual(await readFile(result.path), expectedBytes);
    assert.equal(path.dirname(result.path), path.resolve(artifactRoot));
  });

  it("verifies and reuses an existing identical artifact", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const first = await store.put(envelope());
    const before = await stat(first.path);
    const second = await store.put(envelope());
    const after = await stat(second.path);

    assert.equal(second.hash, first.hash);
    assert.equal(second.path, first.path);
    assert.equal(second.created, false);
    assert.equal(after.ino, before.ino);
  });

  it("converges concurrent identical puts on one valid artifact", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const writes = await Promise.all(
      Array.from({ length: 20 }, () => store.put(envelope())),
    );
    assert.equal(new Set(writes.map((item) => item.hash)).size, 1);
    assert.equal(writes.filter((item) => item.created).length, 1);

    const stored = await store.get(writes[0]!.hash);
    assert.deepEqual(stored.envelope, envelope());
    assert.deepEqual(stored.bytes, canonicalJsonBytes(envelope()));
  });

  it("never overwrites an existing corrupt or colliding target", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const first = await store.put(envelope());
    const corruptBytes = Buffer.from('{"corrupt":true}', "utf8");
    await writeFile(first.path, corruptBytes);

    await assert.rejects(
      store.put(envelope()),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
    );
    assert.deepEqual(await readFile(first.path), corruptBytes);
  });

  it("recomputes the hash and canonical bytes on read", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const first = await store.put(envelope());
    await writeFile(first.path, Buffer.from("{}", "utf8"));

    await assert.rejects(
      store.get(first.hash),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
    );
  });

  it("rejects hash-valid JSON that is not in canonical byte form", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const nonCanonical = Buffer.from(JSON.stringify(envelope(), null, 2), "utf8");
    const hash = createHash("sha256").update(nonCanonical).digest("hex");
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(store.pathFor(hash), nonCanonical);

    await assert.rejects(
      store.get(hash),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_NON_CANONICAL_BYTES",
    );
  });

  it("rejects invalid hashes before resolving a path", () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    assert.throws(
      () => store.pathFor("../outside"),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_INVALID_HASH",
    );
  });

  it("strictly rejects operational metadata in the semantic envelope", () => {
    const value = envelope();
    assert.equal(SemanticArtifactEnvelopeV1Schema.safeParse(value).success, true);
    assert.equal(
      SemanticArtifactEnvelopeV1Schema.safeParse({
        ...value,
        createdAt: "2026-07-12T00:00:00Z",
      }).success,
      false,
    );
    assert.equal(
      SemanticArtifactEnvelopeV1Schema.safeParse({
        ...value,
        producer: { ...value.producer, pid: 42 },
      }).success,
      false,
    );
  });
});
