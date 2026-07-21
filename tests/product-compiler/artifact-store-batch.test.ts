import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  ArtifactCapacityError,
  ArtifactStoreError,
  ContentAddressedArtifactStore,
} from "../../src/product-compiler/artifact-store.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  prepareArtifactStoreBatchPlanV1,
} from "../../src/product-compiler/artifact-store-batch-plan.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";

function envelope(id: string, bytes = 0) {
  return {
    schema: "setfarm.semantic-artifact-envelope.v1" as const,
    artifactType: "setfarm.batch-store-test.v1",
    producer: {
      pass: "artifact-store-batch-test",
      codeSha: "a".repeat(40),
      toolVersions: { node: process.versions.node },
    },
    payload: { id, padding: "x".repeat(bytes) },
  };
}

function prepared(items: readonly Readonly<{
  durabilityTier: number;
  envelope: unknown;
}>[]) {
  return prepareArtifactStoreBatchPlanV1({
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items,
  });
}

function hash(value: unknown): string {
  return createHash("sha256").update(canonicalJsonBytes(value)).digest("hex");
}

async function exists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function finalNames(root: string): Promise<string[]> {
  try {
    return (await readdir(root))
      .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
      .sort();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

describe("artifact store tiered prepared batch publication", () => {
  let sandbox: string;
  let artifactRoot: string;

  beforeEach(async () => {
    sandbox = await mkdtemp(path.join(tmpdir(), "setfarm-artifact-batch-"));
    artifactRoot = path.join(sandbox, "sha256");
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  it("reverifies an all-existing batch inside the held lease without allocation", async () => {
    const first = envelope("first");
    const second = envelope("second");
    const seed = new ContentAddressedArtifactStore(artifactRoot);
    await seed.put(first);
    await seed.put(second);

    const lockObservations: boolean[] = [];
    let measured = false;
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        afterArtifactRead: async () => {
          lockObservations.push(await exists(path.join(artifactRoot, ".capacity.lock")));
        },
        afterCapacityMeasure: () => {
          measured = true;
        },
      },
    });
    const result = await store.putPreparedBatch(prepared([
      { durabilityTier: 0, envelope: first },
      { durabilityTier: 0, envelope: second },
    ]));

    assert.equal(result.schema, "setfarm.artifact-store-batch-put-result.v1");
    assert.equal(result.createdCount, 0);
    assert.equal(result.createdBytes, 0);
    assert.equal(result.items.every((item) => item.created === false), true);
    assert.equal(lockObservations.includes(false), true);
    assert.equal(lockObservations.includes(true), true);
    assert.equal(measured, false);
    assert.equal(await exists(path.join(artifactRoot, ".staging")), false);
  });

  it("rejects aggregate capacity before the first final link", async () => {
    const batch = prepared([
      { durabilityTier: 0, envelope: envelope("one", 300) },
      { durabilityTier: 0, envelope: envelope("two", 300) },
    ]);
    const totalBytes = batch.items.reduce(
      (sum, item) => sum + item.identity.byteLength,
      0,
    );
    let links = 0;
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      limits: {
        maxPayloadBytes: totalBytes,
        rootQuotaBytes: totalBytes - 1,
        minFreeBytes: 0,
      },
      testHooks: {
        afterArtifactLink: () => {
          links += 1;
        },
      },
    });

    await assert.rejects(
      store.putPreparedBatch(batch),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_ROOT_QUOTA_EXCEEDED",
    );
    assert.equal(links, 0);
    assert.deepEqual(await finalNames(artifactRoot), []);
    assert.equal(await exists(path.join(artifactRoot, ".staging")), false);
  });

  it("stages every missing byte before linking in exact tier/hash order", async () => {
    const batch = prepared([
      { durabilityTier: 1, envelope: envelope("root") },
      { durabilityTier: 0, envelope: envelope("dependency-b") },
      { durabilityTier: 0, envelope: envelope("dependency-a") },
    ]);
    const expectedItems = batch.items.map((item) => ({
      durabilityTier: item.durabilityTier,
      hash: item.identity.hash,
    }));
    const events: string[] = [];
    let stagingObserved = false;
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        afterBatchStaging: async ({ items }) => {
          stagingObserved = true;
          assert.deepEqual(
            items.map((item) => [item.durabilityTier, item.artifactHash]),
            expectedItems.map((item) => [item.durabilityTier, item.hash]),
          );
          for (const item of items) {
            const temp = await stat(item.temp);
            assert.equal(temp.isFile(), true);
            assert.equal(temp.nlink, 1);
            assert.equal(await exists(path.join(artifactRoot, `${item.artifactHash}.json`)), false);
          }
        },
        afterBatchArtifactLink: ({ durabilityTier, artifactHash }) => {
          events.push(`link:${durabilityTier}:${artifactHash}`);
        },
        afterBatchTierSync: ({ durabilityTier }) => {
          events.push(`sync:${durabilityTier}`);
        },
      },
    });

    const result = await store.putPreparedBatch(batch);

    assert.equal(stagingObserved, true);
    const expectedEvents: string[] = [];
    for (const tier of [...new Set(expectedItems.map((item) => item.durabilityTier))]) {
      for (const item of expectedItems.filter((candidate) => candidate.durabilityTier === tier)) {
        expectedEvents.push(`link:${tier}:${item.hash}`);
      }
      expectedEvents.push(`sync:${tier}`);
    }
    assert.deepEqual(events, expectedEvents);
    assert.equal(result.createdCount, 3);
    assert.equal(result.createdBytes, result.items.reduce(
      (sum, item) => sum + item.byteLength,
      0,
    ));
    assert.equal(await exists(path.join(artifactRoot, ".staging")), false);
  });

  it("leaves only the permitted immutable tier prefix at five injected failures", async () => {
    const source = [
      { durabilityTier: 0, envelope: envelope("tier-zero-a") },
      { durabilityTier: 0, envelope: envelope("tier-zero-b") },
      { durabilityTier: 1, envelope: envelope("tier-one-a") },
      { durabilityTier: 1, envelope: envelope("tier-one-b") },
    ] as const;
    const batch = prepared(source);
    const tierZeroCount = batch.items.filter((item) => item.durabilityTier === 0).length;
    const cases = [
      { phase: "after-staging", expected: 0 },
      { phase: "during-tier-zero", expected: 1 },
      { phase: "between-tiers", expected: tierZeroCount },
      { phase: "during-tier-one", expected: tierZeroCount + 1 },
      { phase: "before-final", expected: batch.items.length },
    ] as const;

    for (const [index, fixture] of cases.entries()) {
      const root = path.join(sandbox, `case-${index}`);
      let tierZeroLinks = 0;
      let tierOneLinks = 0;
      const fail = () => {
        throw new Error(`INJECTED_${fixture.phase}`);
      };
      const store = new ContentAddressedArtifactStore(root, {
        testHooks: {
          afterBatchStaging: fixture.phase === "after-staging" ? fail : undefined,
          afterBatchArtifactLink: ({ durabilityTier }) => {
            if (durabilityTier === 0) {
              tierZeroLinks += 1;
              if (fixture.phase === "during-tier-zero" && tierZeroLinks === 1) fail();
            } else {
              tierOneLinks += 1;
              if (fixture.phase === "during-tier-one" && tierOneLinks === 1) fail();
            }
          },
          afterBatchTierSync: ({ durabilityTier }) => {
            if (fixture.phase === "between-tiers" && durabilityTier === 0) fail();
          },
          beforeBatchFinalVerification: fixture.phase === "before-final" ? fail : undefined,
        },
      });
      await assert.rejects(store.putPreparedBatch(batch), /INJECTED_/);
      assert.equal((await finalNames(root)).length, fixture.expected, fixture.phase);
      assert.equal(await exists(path.join(root, ".staging")), false, fixture.phase);
      for (const item of batch.items) {
        const final = path.join(root, `${item.identity.hash}.json`);
        if (await exists(final)) {
          assert.deepEqual(await readFile(final), canonicalJsonBytes(
            source.find((entry) => hash(entry.envelope) === item.identity.hash)!.envelope,
          ));
          assert.equal((await stat(final)).nlink, 1);
        }
      }
    }
  });

  it("converges concurrent overlapping batches without duplicate allocation", async () => {
    const a = envelope("a");
    const b = envelope("b");
    const c = envelope("c");
    const store = new ContentAddressedArtifactStore(artifactRoot);
    const [left, right] = await Promise.all([
      store.putPreparedBatch(prepared([
        { durabilityTier: 0, envelope: a },
        { durabilityTier: 0, envelope: b },
      ])),
      store.putPreparedBatch(prepared([
        { durabilityTier: 0, envelope: b },
        { durabilityTier: 0, envelope: c },
      ])),
    ]);

    assert.equal(left.createdCount + right.createdCount, 3);
    assert.deepEqual(await finalNames(artifactRoot), [a, b, c]
      .map((value) => `${hash(value)}.json`)
      .sort());
    for (const value of [a, b, c]) {
      assert.deepEqual(await readFile(path.join(artifactRoot, `${hash(value)}.json`)), canonicalJsonBytes(value));
    }
  });

  it("converges when an exact target wins the no-replace link race", async () => {
    const value = envelope("exact-link-race");
    const batch = prepared([{ durabilityTier: 0, envelope: value }]);
    const target = path.join(artifactRoot, `${hash(value)}.json`);
    const bytes = canonicalJsonBytes(value);
    const linkResults: boolean[] = [];
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        afterBatchStaging: async () => {
          await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
        },
        afterBatchArtifactLink: ({ created }) => {
          linkResults.push(created);
        },
      },
    });

    const result = await store.putPreparedBatch(batch);

    assert.deepEqual(linkResults, [false]);
    assert.equal(result.createdCount, 0);
    assert.equal(result.createdBytes, 0);
    assert.equal(result.items[0]?.created, false);
    assert.deepEqual(await readFile(target), bytes);
    assert.equal(await exists(path.join(artifactRoot, ".staging")), false);
  });

  it("never overwrites a corrupt target that wins the no-replace link race", async () => {
    const value = envelope("corrupt-link-race");
    const batch = prepared([{ durabilityTier: 0, envelope: value }]);
    const target = path.join(artifactRoot, `${hash(value)}.json`);
    const corrupt = Buffer.from("corrupt-race-winner", "utf8");
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        afterBatchStaging: async () => {
          await writeFile(target, corrupt, { flag: "wx", mode: 0o600 });
        },
      },
    });

    await assert.rejects(
      store.putPreparedBatch(batch),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
    );
    assert.deepEqual(await readFile(target), corrupt);
    assert.equal(await exists(path.join(artifactRoot, ".staging")), false);
  });

  it("never overwrites a corrupt target during batch publication", async () => {
    const value = envelope("collision");
    const batch = prepared([{ durabilityTier: 0, envelope: value }]);
    const target = path.join(artifactRoot, `${hash(value)}.json`);
    const corrupt = Buffer.from("corrupt-existing", "utf8");
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(target, corrupt, { mode: 0o600 });
    const store = new ContentAddressedArtifactStore(artifactRoot);

    await assert.rejects(
      store.putPreparedBatch(batch),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
    );
    assert.deepEqual(await readFile(target), corrupt);
  });

  it("fails closed when a staged temp is replaced before its first link", async () => {
    const value = envelope("temp-aba");
    const expectedBytes = canonicalJsonBytes(value);
    let replacement = "";
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        afterBatchStaging: async ({ items }) => {
          const temp = items[0]!.temp;
          replacement = temp;
          await rename(temp, `${temp}.displaced`);
          await writeFile(temp, expectedBytes, { mode: 0o600 });
        },
      },
    });

    await assert.rejects(
      store.putPreparedBatch(prepared([{ durabilityTier: 0, envelope: value }])),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_FILE_CHANGED_DURING_READ",
    );
    assert.equal(await exists(path.join(artifactRoot, `${hash(value)}.json`)), false);
    assert.deepEqual(await readFile(replacement), expectedBytes);
  });

  it("freshly verifies every final target before returning a result", async () => {
    const value = envelope("fresh-final");
    const target = path.join(artifactRoot, `${hash(value)}.json`);
    const corrupt = Buffer.from("corrupt-after-link", "utf8");
    const store = new ContentAddressedArtifactStore(artifactRoot, {
      testHooks: {
        beforeBatchFinalVerification: async () => {
          await writeFile(target, corrupt);
        },
      },
    });

    await assert.rejects(
      store.putPreparedBatch(prepared([{ durabilityTier: 0, envelope: value }])),
      (error: unknown) =>
        error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
    );
    assert.deepEqual(await readFile(target), corrupt);
  });

  it("routes put through a private batch core that a caller cannot replace", async () => {
    const value = envelope("single-private-core");
    const store = new ContentAddressedArtifactStore(artifactRoot);
    let redirected = false;
    Object.defineProperty(store, "putPreparedBatch", {
      configurable: true,
      value: async () => {
        redirected = true;
        throw new Error("CALLER_BATCH_OVERRIDE");
      },
    });

    const result = await store.put(value);

    assert.equal(redirected, false);
    assert.equal(result.hash, hash(value));
    assert.deepEqual(await readFile(result.path), canonicalJsonBytes(value));
  });
});
