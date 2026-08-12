import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import {
  ArtifactCapacityError,
  ArtifactStoreError,
  ContentAddressedArtifactStore,
  SemanticArtifactEnvelopeV1Schema,
} from "../../src/product-compiler/artifact-store.js";
import { CanonicalJsonLimitError } from "../../src/product-compiler/bounded-canonical-json.js";
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

  it("preserves a missing bounded-read target as ARTIFACT_NOT_FOUND", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    await assert.rejects(
      store.get("d".repeat(64)),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_NOT_FOUND",
    );
    await assert.rejects(stat(artifactRoot), { code: "ENOENT" });
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

  it("returns one stable verified byte snapshot without reopening the path", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const expectedBytes = canonicalJsonBytes(envelope());
    const written = await store.put(envelope());

    const stored = await store.get(written.hash);
    await writeFile(written.path, Buffer.from("{}", "utf8"));

    assert.deepEqual(stored.bytes, expectedBytes);
    assert.deepEqual(stored.envelope, envelope());
  });

  it("does not follow a symbolic link even when its target contains exact artifact bytes", {
    skip: process.platform === "win32",
  }, async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const written = await store.put(envelope());
    const outside = path.join(tempRoot, "outside-exact-artifact.json");
    await writeFile(outside, canonicalJsonBytes(envelope()));
    await rm(written.path);
    await symlink(outside, written.path);

    for (const operation of [
      () => store.get(written.hash),
      () => store.put(envelope()),
    ]) {
      await assert.rejects(
        operation,
        (error: unknown) =>
          error instanceof ArtifactStoreError
          && error.code === "ARTIFACT_UNSAFE_FILE_TYPE",
      );
    }
  });

  it("classifies an existing Unix socket as an unsafe artifact file", {
    skip: process.platform === "win32",
  }, async () => {
    // Darwin's sockaddr_un path is only 104 bytes; use a deliberately short
    // root so the canonical 64-hex artifact filename itself remains realistic.
    const socketRoot = await mkdtemp("/tmp/setfarm-socket-");
    const store = new ContentAddressedArtifactStore(socketRoot);
    const hash = "e".repeat(64);
    const socketPath = store.pathFor(hash);
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, resolve);
    });
    try {
      await assert.rejects(
        store.get(hash),
        (error: unknown) =>
          error instanceof ArtifactStoreError
          && error.code === "ARTIFACT_UNSAFE_FILE_TYPE",
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      await rm(socketRoot, { recursive: true, force: true });
    }
  });

  it("preserves EACCES for an existing inaccessible regular file", {
    skip: process.platform === "win32" || process.getuid?.() === 0,
  }, async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const hash = "f".repeat(64);
    await mkdir(artifactRoot, { recursive: true });
    const target = store.pathFor(hash);
    await writeFile(target, Buffer.from("regular", "utf8"));
    await chmod(target, 0o000);
    try {
      await assert.rejects(
        store.get(hash),
        (error: unknown) =>
          error instanceof Error
          && "code" in error
          && error.code === "EACCES"
          && !(error instanceof ArtifactStoreError),
      );
    } finally {
      await chmod(target, 0o600);
    }
  });

  it("rejects a FIFO without blocking on an absent writer", {
    skip: process.platform === "win32",
  }, async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const hash = "b".repeat(64);
    await mkdir(artifactRoot, { recursive: true });
    execFileSync("mkfifo", [store.pathFor(hash)]);

    const moduleUrl = pathToFileURL(
      path.resolve("src/product-compiler/artifact-store.ts"),
    ).href;
    const program = [
      `import { ContentAddressedArtifactStore } from ${JSON.stringify(moduleUrl)};`,
      `const store = new ContentAddressedArtifactStore(${JSON.stringify(artifactRoot)});`,
      `try { await store.get(${JSON.stringify(hash)}); process.exit(2); }`,
      `catch (error) { process.exit(error?.code === "ARTIFACT_UNSAFE_FILE_TYPE" ? 0 : 3); }`,
    ].join("\n");
    const child = spawnSync(process.execPath, [
      "--import", "tsx", "--input-type=module", "--eval", program,
    ], {
      cwd: path.resolve("."),
      encoding: "utf8",
      timeout: 2_000,
    });

    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.signal, null, `FIFO reader timed out: ${child.stderr}`);
    assert.equal(child.status, 0, child.stderr);
  });

  it("rejects an oversized regular file before allocating its declared size", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      limits: {
        maxPayloadBytes: 128,
        rootQuotaBytes: 1024,
        minFreeBytes: 0,
      },
    });
    const hash = "c".repeat(64);
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(store.pathFor(hash), Buffer.alloc(129));

    await assert.rejects(
      store.get(hash),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_BOUNDED_READ_EXCEEDED",
    );
  });

  it("rejects deterministic mutation between the bounded read and second fstat", async () => {
    const writer = new ContentAddressedArtifactStore(artifactRoot);
    const written = await writer.put(envelope());
    const expectedBytes = canonicalJsonBytes(envelope());
    const reader = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        afterArtifactRead: async ({ target, artifactHash, byteLength }) => {
          assert.equal(target, written.path);
          assert.equal(artifactHash, written.hash);
          assert.equal(byteLength, expectedBytes.length);
          await writeFile(target, Buffer.concat([expectedBytes, Buffer.from([0])]));
        },
      },
    });

    await assert.rejects(
      reader.get(written.hash),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_FILE_CHANGED_DURING_READ",
    );
  });

  it("binds reuse to the held root and rejects whole-root replacement", async () => {
    const writer = new ContentAddressedArtifactStore(artifactRoot);
    const written = await writer.put(envelope());
    const displacedRoot = path.join(tempRoot, "displaced-artifact-root");
    const corruptReplacement = Buffer.from('{"corrupt":true}', "utf8");
    let replaced = false;
    const reader = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        afterArtifactRead: async ({ artifactHash }) => {
          assert.equal(artifactHash, written.hash);
          assert.equal(replaced, false);
          replaced = true;
          await rename(artifactRoot, displacedRoot);
          await mkdir(artifactRoot, { recursive: true });
          await writeFile(reader.pathFor(written.hash), corruptReplacement);
        },
      },
    });

    await assert.rejects(
      reader.put(envelope()),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_FILE_CHANGED_DURING_READ",
    );
    assert.equal(replaced, true);
    assert.deepEqual(await readFile(reader.pathFor(written.hash)), corruptReplacement);
    assert.deepEqual(
      await readFile(path.join(displacedRoot, `${written.hash}.json`)),
      canonicalJsonBytes(envelope()),
    );
  });

  it("does not report created when the root is replaced after no-replace link", async () => {
    const displacedRoot = path.join(tempRoot, "post-link-displaced-root");
    let replaced = false;
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        afterArtifactLink: async ({ artifactHash, target }) => {
          assert.equal(path.basename(target), `${artifactHash}.json`);
          assert.equal(replaced, false);
          replaced = true;
          await rename(artifactRoot, displacedRoot);
          await mkdir(artifactRoot, { recursive: true });
        },
      },
    });

    await assert.rejects(
      store.put(envelope()),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
    );
    assert.equal(replaced, true);
    const displacedEntries = await readdir(displacedRoot);
    assert.ok(displacedEntries.some((entry) => /^[a-f0-9]{64}\.json$/.test(entry)));
    assert.equal(
      (await readdir(artifactRoot)).some((entry) => entry.endsWith(".json")),
      false,
    );
  });

  it("rejects a configured root symlink retarget inside the capacity lease", {
    skip: process.platform === "win32",
  }, async () => {
    const firstRoot = path.join(tempRoot, "capacity-root-a");
    const secondRoot = path.join(tempRoot, "capacity-root-b");
    await mkdir(firstRoot, { recursive: true });
    await mkdir(secondRoot, { recursive: true });
    await mkdir(path.dirname(artifactRoot), { recursive: true });
    await symlink(firstRoot, artifactRoot, "dir");
    let retargeted = false;
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        afterCapacityMeasure: async () => {
          assert.equal(retargeted, false);
          retargeted = true;
          await rm(artifactRoot);
          await symlink(secondRoot, artifactRoot, "dir");
        },
      },
    });

    await assert.rejects(
      store.put(envelope()),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
    );
    assert.equal(retargeted, true);
    assert.equal(
      (await readdir(secondRoot)).some((entry) => entry.endsWith(".json")),
      false,
    );
  });

  it("measures the held physical root across a symlink ABA override", {
    skip: process.platform === "win32",
  }, async () => {
    const firstRoot = path.join(tempRoot, "aba-capacity-root-a");
    const secondRoot = path.join(tempRoot, "aba-capacity-root-b");
    await mkdir(firstRoot, { recursive: true });
    await mkdir(secondRoot, { recursive: true });
    await writeFile(path.join(firstRoot, "existing.json"), Buffer.from([1]));
    await mkdir(path.dirname(artifactRoot), { recursive: true });
    await symlink(firstRoot, artifactRoot, "dir");
    const payloadBytes = canonicalJsonBytes(envelope()).length;
    let measuredOverride = false;
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      limits: {
        maxPayloadBytes: payloadBytes,
        rootQuotaBytes: payloadBytes,
        minFreeBytes: 0,
      },
      measure: async () => {
        measuredOverride = true;
        await rm(artifactRoot);
        await symlink(secondRoot, artifactRoot, "dir");
        const undercount = { rootBytes: 0, freeBytes: Number.MAX_SAFE_INTEGER };
        await rm(artifactRoot);
        await symlink(firstRoot, artifactRoot, "dir");
        return undercount;
      },
    });

    await assert.rejects(
      store.put(envelope()),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_ROOT_QUOTA_EXCEEDED",
    );
    assert.equal(measuredOverride, true);
    assert.deepEqual(
      (await readdir(firstRoot)).filter((entry) => entry.endsWith(".json")),
      ["existing.json"],
    );
  });

  it("preserves a configured artifact-root directory symlink", {
    skip: process.platform === "win32",
  }, async () => {
    const realRoot = path.join(tempRoot, "real-artifact-root");
    await mkdir(realRoot, { recursive: true });
    await mkdir(path.dirname(artifactRoot), { recursive: true });
    await symlink(realRoot, artifactRoot, "dir");
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      limits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 512 * 1024 * 1024,
        minFreeBytes: 0,
      },
    });

    const first = await store.put(envelope());
    const reused = await store.put(envelope());
    const stored = await store.get(first.hash);

    assert.equal(first.created, true);
    assert.equal(reused.created, false);
    assert.deepEqual(stored.bytes, canonicalJsonBytes(envelope()));
    assert.equal((await stat(first.path)).isFile(), true);
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

  it("bounds a hash-valid hostile envelope before schema traversal", async () => {
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const toolVersions: Record<string, unknown> = {};
    for (let index = 0; index < 100_001; index += 1) {
      toolVersions[`tool-${index}`] = "1";
    }
    // Schema-first validation would report this early invalid value instead of
    // enforcing the aggregate container authority.
    toolVersions["tool-0"] = 0;
    const hostile = {
      ...envelope(),
      producer: { ...envelope().producer, toolVersions },
    };
    const bytes = canonicalJsonBytes(hostile);
    const hash = createHash("sha256").update(bytes).digest("hex");
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(store.pathFor(hash), bytes);

    await assert.rejects(
      store.get(hash),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_INVALID_ENVELOPE"
        && error.cause instanceof CanonicalJsonLimitError
        && error.cause.code === "CANONICAL_JSON_MAX_CONTAINER_ENTRIES_EXCEEDED",
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
