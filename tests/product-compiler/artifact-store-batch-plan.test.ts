import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { ArtifactCapacityError } from "../../src/product-compiler/artifact-capacity.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  ArtifactStoreBatchPlanError,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
} from "../../src/product-compiler/artifact-store-batch-plan.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";

function envelope(id: string, payload: unknown = { id }) {
  return {
    schema: "setfarm.semantic-artifact-envelope.v1" as const,
    artifactType: "setfarm.batch-plan-test.v1",
    producer: {
      pass: "artifact-store-batch-plan-test",
      codeSha: "a".repeat(40),
      model: "模型-v1",
      promptHash: "b".repeat(64),
      toolVersions: { node: "22.0.0", "é": "值" },
    },
    payload,
  };
}

function plan(items: readonly Readonly<{
  durabilityTier: number;
  envelope: unknown;
}>[]) {
  return {
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items,
  };
}

function hash(value: unknown): string {
  return createHash("sha256").update(canonicalJsonBytes(value)).digest("hex");
}

describe("artifact store prepared batch plan v1", () => {
  it("pins bounded UTF-8 identity and canonical tier/hash ordering", () => {
    const dependency = envelope("dependency", { text: "e\u0301/😀/依存" });
    const root = envelope("root", { text: "根/é" });
    const prepared = prepareArtifactStoreBatchPlanV1(plan([
      { durabilityTier: 1, envelope: root },
      { durabilityTier: 0, envelope: dependency },
    ]));

    assert.equal(prepared.schema, "setfarm.prepared-artifact-store-batch.v1");
    assert.equal(prepared.occurrenceCount, 2);
    assert.deepEqual(
      prepared.items.map((item) => [item.durabilityTier, item.identity.hash]),
      [
        [0, "4d2a31ba8b684c59f94b857fe4d695b1bded8e5ddefcc59cc46f91e5c4c77062"],
        [1, "651e9280a2c506a03ffb7aba4c54584b85c43e92c351291a8b692c23499d45b7"],
      ],
    );
    const independentPlanIdentity = hash({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [
        {
          durabilityTier: 0,
          identity: {
            hash: hash(dependency),
            artifactType: dependency.artifactType,
            byteLength: canonicalJsonBytes(dependency).length,
            producer: dependency.producer,
          },
        },
        {
          durabilityTier: 1,
          identity: {
            hash: hash(root),
            artifactType: root.artifactType,
            byteLength: canonicalJsonBytes(root).length,
            producer: root.producer,
          },
        },
      ],
    });
    assert.equal(
      independentPlanIdentity,
      "d513aeb5fe74da8a9f2d3d76a295cdf884d418b630ca53cc2f06987335c296bb",
    );
    assert.equal(
      prepared.planIdentityHash,
      independentPlanIdentity,
    );
    const copies = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
    assert.deepEqual(copies.map((item) => item.bytes), [
      canonicalJsonBytes(dependency),
      canonicalJsonBytes(root),
    ]);
  });

  it("rejects hostile outer and item containers without invoking traps or getters", () => {
    let traps = 0;
    const proxiedPlan = new Proxy(plan([{ durabilityTier: 0, envelope: envelope("p") }]), {
      getPrototypeOf() {
        traps += 1;
        throw new Error("outer prototype trap");
      },
      ownKeys() {
        traps += 1;
        throw new Error("outer keys trap");
      },
    });
    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(proxiedPlan),
      (error: unknown) =>
        error instanceof ArtifactStoreBatchPlanError
        && error.code === "ARTIFACT_BATCH_PLAN_INVALID",
    );
    assert.equal(traps, 0);

    let getterCalls = 0;
    const accessorItem = Object.defineProperty({
      durabilityTier: 0,
    }, "envelope", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return envelope("getter");
      },
    });
    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan([accessorItem as never])),
      (error: unknown) =>
        error instanceof ArtifactStoreBatchPlanError
        && error.code === "ARTIFACT_BATCH_PLAN_INVALID",
    );
    assert.equal(getterCalls, 0);

    let itemTraps = 0;
    const proxiedItem = new Proxy({
      durabilityTier: 0,
      envelope: envelope("item-proxy"),
    }, {
      getPrototypeOf() {
        itemTraps += 1;
        throw new Error("item prototype trap");
      },
      ownKeys() {
        itemTraps += 1;
        throw new Error("item keys trap");
      },
    });
    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan([proxiedItem])),
      ArtifactStoreBatchPlanError,
    );
    assert.equal(itemTraps, 0);

    const sparse = new Array(2);
    sparse[1] = { durabilityTier: 0, envelope: envelope("sparse") };
    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan(sparse)),
      (error: unknown) =>
        error instanceof ArtifactStoreBatchPlanError
        && error.code === "ARTIFACT_BATCH_PLAN_INVALID",
    );
  });

  it("rejects invalid occurrence counts, item keys, and non-dense tiers", () => {
    const ten = Array.from({ length: 10 }, (_, index) => ({
      durabilityTier: 0,
      envelope: envelope(`too-many-${index}`),
    }));
    const extra = {
      durabilityTier: 0,
      envelope: envelope("extra"),
      hiddenAuthority: true,
    };
    const cases: unknown[] = [
      plan([]),
      plan(ten),
      plan([extra]),
      plan([{ durabilityTier: -1, envelope: envelope("negative") }]),
      plan([{ durabilityTier: 1.5, envelope: envelope("fraction") }]),
      plan([{ durabilityTier: 9, envelope: envelope("too-high") }]),
      plan([
        { durabilityTier: 0, envelope: envelope("tier-zero") },
        { durabilityTier: 2, envelope: envelope("tier-two") },
      ]),
    ];

    for (const candidate of cases) {
      assert.throws(
        () => prepareArtifactStoreBatchPlanV1(candidate),
        (error: unknown) =>
          error instanceof ArtifactStoreBatchPlanError
          && error.code === "ARTIFACT_BATCH_PLAN_INVALID",
      );
    }
  });

  it("deduplicates exact same-tier bytes and rejects a cross-tier duplicate", () => {
    const shared = envelope("shared");
    const prepared = prepareArtifactStoreBatchPlanV1(plan([
      { durabilityTier: 0, envelope: shared },
      { durabilityTier: 0, envelope: structuredClone(shared) },
    ]));
    assert.equal(prepared.occurrenceCount, 2);
    assert.equal(prepared.items.length, 1);

    const unordered = prepareArtifactStoreBatchPlanV1(plan([
      { durabilityTier: 0, envelope: envelope("z-order") },
      { durabilityTier: 0, envelope: envelope("a-order") },
    ]));
    assert.deepEqual(
      unordered.items.map((item) => item.identity.hash),
      [...unordered.items.map((item) => item.identity.hash)].sort(),
    );

    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan([
        { durabilityTier: 0, envelope: shared },
        { durabilityTier: 1, envelope: structuredClone(shared) },
      ])),
      (error: unknown) =>
        error instanceof ArtifactStoreBatchPlanError
        && error.code === "ARTIFACT_BATCH_DUPLICATE_CONFLICT",
    );
  });

  it("rejects producer identities that exceed migration 23 aggregate authority", () => {
    const toolVersions = Object.fromEntries(Array.from({ length: 650 }, (_, index) => [
      `tool-${String(index).padStart(4, "0")}`,
      "v".repeat(180),
    ]));
    const occurrences = Array.from({ length: 5 }, (_, index) => {
      const value = envelope(`producer-budget-${index}`);
      value.producer.toolVersions = { ...toolVersions };
      return { durabilityTier: 0, envelope: value };
    });

    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan(occurrences)),
      (error: unknown) =>
        error instanceof ArtifactStoreBatchPlanError
        && error.code === "ARTIFACT_BATCH_PLAN_INVALID"
        && /aggregate byte budget/.test(error.message),
    );
  });

  it("bounds canonical payload work before semantic schema traversal", () => {
    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan([{
        durabilityTier: 0,
        envelope: envelope("large", { text: "x".repeat(1_000) }),
      }]), { maxPayloadBytes: 256 }),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_PAYLOAD_TOO_LARGE",
    );

    let deep: unknown = null;
    for (let index = 0; index < 130; index += 1) deep = { child: deep };
    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan([{
        durabilityTier: 0,
        envelope: envelope("deep", deep),
      }])),
      (error: unknown) =>
        error instanceof ArtifactCapacityError
        && error.code === "ARTIFACT_PAYLOAD_TOO_LARGE",
    );
  });

  it("rejects proxied envelopes and database-unsafe producer Unicode", () => {
    let traps = 0;
    const proxiedEnvelope = new Proxy(envelope("proxy"), {
      getPrototypeOf() {
        traps += 1;
        throw new Error("envelope prototype trap");
      },
      ownKeys() {
        traps += 1;
        throw new Error("envelope keys trap");
      },
    });
    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan([{
        durabilityTier: 0,
        envelope: proxiedEnvelope,
      }])),
      ArtifactStoreBatchPlanError,
    );
    assert.equal(traps, 0);

    const unsafe = envelope("unsafe");
    unsafe.producer.pass = "bad\ud800";
    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan([{
        durabilityTier: 0,
        envelope: unsafe,
      }])),
      (error: unknown) =>
        error instanceof ArtifactStoreBatchPlanError
        && error.code === "ARTIFACT_BATCH_PLAN_INVALID",
    );

    assert.throws(
      () => prepareArtifactStoreBatchPlanV1(plan([{
        durabilityTier: 0,
        envelope: envelope("unsafe-payload", { text: "bad\udc00" }),
      }])),
      (error: unknown) =>
        error instanceof ArtifactStoreBatchPlanError
        && error.code === "ARTIFACT_BATCH_PLAN_INVALID",
    );
  });

  it("owns immutable snapshots and never exposes its private buffers", () => {
    const original = envelope("immutable", { value: "before" });
    const expectedBytes = canonicalJsonBytes(original);
    const prepared = prepareArtifactStoreBatchPlanV1(plan([{
      durabilityTier: 0,
      envelope: original,
    }]));
    original.payload = { value: "after" };
    original.producer.toolVersions.node = "mutated";

    const first = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
    assert.deepEqual(first[0]!.bytes, expectedBytes);
    assert.equal(Object.isFrozen(prepared), true);
    assert.equal(Object.isFrozen(prepared.items), true);
    assert.equal(Object.isFrozen(prepared.items[0]!.identity), true);
    assert.equal(Object.isFrozen(prepared.items[0]!.identity.producer), true);
    assert.equal(Object.isFrozen(prepared.items[0]!.identity.producer.toolVersions), true);

    first[0]!.bytes.fill(0);
    assert.deepEqual(
      copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared)[0]!.bytes,
      expectedBytes,
    );

    assert.throws(
      () => copyPreparedArtifactStoreBatchCanonicalItemsV1({
        schema: "setfarm.prepared-artifact-store-batch.v1",
        planIdentityHash: prepared.planIdentityHash,
        occurrenceCount: prepared.occurrenceCount,
        items: prepared.items,
      }),
      (error: unknown) =>
        error instanceof ArtifactStoreBatchPlanError
        && error.code === "ARTIFACT_BATCH_PLAN_INVALID",
    );

    let preparedTraps = 0;
    const proxiedPrepared = new Proxy(prepared, {
      getPrototypeOf() {
        preparedTraps += 1;
        throw new Error("prepared prototype trap");
      },
    });
    assert.throws(
      () => copyPreparedArtifactStoreBatchCanonicalItemsV1(proxiedPrepared),
      ArtifactStoreBatchPlanError,
    );
    assert.equal(preparedTraps, 0);
  });

  it("does not dispatch canonical authority through a mutable prototype", () => {
    const value = envelope("prototype-poison");
    const prepared = prepareArtifactStoreBatchPlanV1(plan([{
      durabilityTier: 0,
      envelope: value,
    }]));
    const prototype = Object.getPrototypeOf(prepared) as Record<PropertyKey, unknown>;
    const original = Object.getOwnPropertyDescriptor(prototype, "copyCanonicalItems");

    Object.defineProperty(prototype, "copyCanonicalItems", {
      configurable: true,
      value: () => [{
        durabilityTier: 8,
        identity: prepared.items[0]!.identity,
        bytes: Buffer.from("FORGED"),
      }],
    });
    try {
      const copied = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
      assert.equal(copied[0]!.durabilityTier, 0);
      assert.deepEqual(copied[0]!.bytes, canonicalJsonBytes(value));
    } finally {
      if (original) {
        Object.defineProperty(prototype, "copyCanonicalItems", original);
      } else {
        Reflect.deleteProperty(prototype, "copyCanonicalItems");
      }
    }
  });

  it("does not expose constructor authority through its public prototype", () => {
    const prepared = prepareArtifactStoreBatchPlanV1(plan([{
      durabilityTier: 0,
      envelope: envelope("constructor-forgery"),
    }]));
    const exposedConstructor = Object.getPrototypeOf(prepared).constructor as new (
      ...args: unknown[]
    ) => unknown;

    assert.throws(
      () => new exposedConstructor(
        Object.freeze({}),
        prepared.occurrenceCount,
        copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared),
      ),
      (error: unknown) =>
        error instanceof ArtifactStoreBatchPlanError
        && error.code === "ARTIFACT_BATCH_PLAN_INVALID",
    );
  });

  it("isolates private and returned bytes from the shared small-buffer pool", () => {
    const prepared = prepareArtifactStoreBatchPlanV1(plan([{
      durabilityTier: 0,
      envelope: envelope("unpooled", {
        canary: "SETFARM_PRIVATE_BATCH_CANONICAL_BYTES_7d9e7f5b",
      }),
    }]));
    const publicBytes = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared)[0]!.bytes;
    const needle = Buffer.allocUnsafeSlow(publicBytes.length);
    publicBytes.copy(needle);
    const backing = Buffer.from(publicBytes.buffer);
    const publicStart = publicBytes.byteOffset;
    const publicEnd = publicStart + publicBytes.length;
    let overwrittenAliases = 0;

    for (let offset = 0; offset <= backing.length - needle.length; offset += 1) {
      const overlapsPublicView = offset < publicEnd && offset + needle.length > publicStart;
      if (!overlapsPublicView && backing.subarray(offset, offset + needle.length).equals(needle)) {
        backing.fill(0x58, offset, offset + needle.length);
        overwrittenAliases += 1;
      }
    }

    assert.equal(publicBytes.byteOffset, 0);
    assert.equal(publicBytes.buffer.byteLength, publicBytes.length);
    assert.equal(overwrittenAliases, 0);
    const next = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared)[0]!.bytes;
    assert.equal(
      createHash("sha256").update(next).digest("hex"),
      prepared.items[0]!.identity.hash,
    );
  });
});
