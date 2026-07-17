import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CanonicalJsonLimitError,
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
  type CanonicalJsonBoundedLimits,
} from "../../src/product-compiler/bounded-canonical-json.js";
import {
  CanonicalJsonError,
  canonicalJsonBytes,
  type CanonicalJsonErrorCode,
} from "../../src/product-compiler/canonical-json.js";

function boundedLimits(
  overrides: Partial<CanonicalJsonBoundedLimits> = {},
): CanonicalJsonBoundedLimits {
  return {
    maxBytes: 1024 * 1024,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    ...overrides,
  };
}

describe("bounded Setfarm Canonical JSON v1", () => {
  it("emits byte-identical canonical JSON for accepted values", () => {
    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
      z: "last",
      a: "first",
    });
    const shared = { stable: true };
    const values: unknown[] = [
      null,
      true,
      false,
      -0,
      1.25e30,
      "",
      "\"\\\b\t\n\f\r\u0000\u001f/é/e\u0301/😀/\ud800/\udc00/\u2028",
      ["z", "a", { second: 2, first: 1 }],
      { z: 1, "2": "two", "10": "ten", a: nullPrototype },
      nullPrototype,
      { left: shared, right: shared },
    ];

    for (const value of values) {
      assert.deepEqual(
        canonicalJsonBytesBounded(value, boundedLimits()),
        canonicalJsonBytes(value),
      );
    }
  });

  it("publishes explicit, stable default work limits", () => {
    assert.deepEqual(DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS, {
      maxDepth: 128,
      maxNodes: 250_000,
      maxContainerEntries: 100_000,
      maxWorkUnits: 32 * 1024 * 1024,
    });
    assert.equal(Object.isFrozen(DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS), true);
  });

  it("bounds output bytes before materializing a full encoded payload", () => {
    assert.throws(
      () => canonicalJsonBytesBounded("x".repeat(10_000), boundedLimits({
        maxBytes: 128,
      })),
      (error: unknown) =>
        error instanceof CanonicalJsonLimitError
        && error.code === "CANONICAL_JSON_MAX_BYTES_EXCEEDED"
        && error.limit === 128,
    );
  });

  it("bounds depth, nodes, container entries, and traversal work", () => {
    let deep: unknown = null;
    for (let index = 0; index < 20; index += 1) deep = { nested: deep };

    const cases: Array<Readonly<{
      value: unknown;
      limits: Partial<CanonicalJsonBoundedLimits>;
      code: CanonicalJsonLimitError["code"];
      limit: number;
    }>> = [
      {
        value: deep,
        limits: { maxDepth: 16 },
        code: "CANONICAL_JSON_MAX_DEPTH_EXCEEDED",
        limit: 16,
      },
      {
        value: [[null], [null]],
        limits: { maxNodes: 4 },
        code: "CANONICAL_JSON_MAX_NODES_EXCEEDED",
        limit: 4,
      },
      {
        value: [1, 2, 3],
        limits: { maxContainerEntries: 2 },
        code: "CANONICAL_JSON_MAX_CONTAINER_ENTRIES_EXCEEDED",
        limit: 2,
      },
      {
        value: { aaaaa: 1, aaaab: 2 },
        limits: { maxWorkUnits: 4 },
        code: "CANONICAL_JSON_MAX_WORK_EXCEEDED",
        limit: 4,
      },
    ];

    for (const testCase of cases) {
      assert.throws(
        () => canonicalJsonBytesBounded(
          testCase.value,
          boundedLimits(testCase.limits),
        ),
        (error: unknown) =>
          error instanceof CanonicalJsonLimitError
          && error.code === testCase.code
          && error.limit === testCase.limit,
      );
    }
  });

  it("rejects invalid limit authority", () => {
    for (const maxBytes of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      assert.throws(
        () => canonicalJsonBytesBounded(null, boundedLimits({ maxBytes })),
        RangeError,
      );
    }
  });

  it("preserves canonical rejection codes for invalid input shapes", () => {
    const sparse = new Array(2);
    sparse[1] = "present";
    const extended = ["value"] as string[] & { extra?: string };
    extended.extra = "not canonical";
    const accessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => "side effect",
    });
    const withSymbol = { value: 1 } as Record<PropertyKey, unknown>;
    withSymbol[Symbol("hidden")] = true;
    const withHidden = Object.defineProperty({ value: 1 }, "hidden", {
      enumerable: false,
      value: true,
    });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    const cases: Array<readonly [unknown, CanonicalJsonErrorCode]> = [
      [undefined, "CANONICAL_JSON_UNSUPPORTED_TYPE"],
      [Number.NaN, "CANONICAL_JSON_NON_FINITE_NUMBER"],
      [sparse, "CANONICAL_JSON_SPARSE_ARRAY"],
      [extended, "CANONICAL_JSON_ARRAY_PROPERTY"],
      [cyclic, "CANONICAL_JSON_CYCLE"],
      [accessor, "CANONICAL_JSON_ACCESSOR_PROPERTY"],
      [withSymbol, "CANONICAL_JSON_SYMBOL_PROPERTY"],
      [withHidden, "CANONICAL_JSON_NON_ENUMERABLE_PROPERTY"],
      [new Date(0), "CANONICAL_JSON_UNSUPPORTED_PROTOTYPE"],
    ];

    for (const [value, expectedCode] of cases) {
      assert.throws(
        () => canonicalJsonBytesBounded(value, boundedLimits()),
        (error: unknown) =>
          error instanceof CanonicalJsonError
          && error.code === expectedCode,
      );
    }
  });

  it("rejects proxies without invoking caller-owned traps", () => {
    const target = [0];
    let traps = 0;
    const callerOwned = new Proxy(target, {
      getPrototypeOf() {
        traps += 1;
        throw new Error("hostile prototype trap");
      },
      ownKeys() {
        traps += 1;
        throw new Error("hostile ownKeys trap");
      },
    });

    assert.throws(
      () => canonicalJsonBytesBounded(callerOwned, boundedLimits()),
      (error: unknown) =>
        error instanceof CanonicalJsonError
        && error.code === "CANONICAL_JSON_UNSUPPORTED_PROTOTYPE",
    );
    assert.equal(traps, 0);
    assert.deepEqual(target, [0]);
  });
});
