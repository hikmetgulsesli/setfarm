import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  CanonicalJsonError,
  canonicalJsonBytes,
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";

describe("Setfarm Canonical JSON v1", () => {
  it("sorts object keys by UTF-16 code units at every depth", () => {
    const value = {
      z: { beta: 2, alpha: 1 },
      "2": "two",
      "10": "ten",
      a: true,
    };
    assert.equal(
      canonicalJsonStringify(value),
      '{"10":"ten","2":"two","a":true,"z":{"alpha":1,"beta":2}}',
    );
  });

  it("preserves declared array order", () => {
    assert.equal(
      canonicalJsonStringify(["z", "a", { second: 2, first: 1 }]),
      '["z","a",{"first":1,"second":2}]',
    );
  });

  it("preserves Unicode strings without normalization", () => {
    const composed = "é";
    const decomposed = "e\u0301";
    assert.notEqual(composed, decomposed);
    assert.equal(canonicalJsonStringify(composed), JSON.stringify(composed));
    assert.equal(canonicalJsonStringify(decomposed), JSON.stringify(decomposed));
    assert.notEqual(hashCanonicalJson(composed), hashCanonicalJson(decomposed));
  });

  it("serializes negative zero as zero and rejects non-finite numbers", () => {
    assert.equal(canonicalJsonStringify(-0), "0");
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.throws(
        () => canonicalJsonStringify(value),
        (error: unknown) =>
          error instanceof CanonicalJsonError
          && error.code === "CANONICAL_JSON_NON_FINITE_NUMBER",
      );
    }
  });

  it("rejects unsupported JSON values", () => {
    for (const value of [undefined, 1n, Symbol("x"), () => true, new Date(0), new Map()]) {
      assert.throws(
        () => canonicalJsonStringify(value),
        (error: unknown) => error instanceof CanonicalJsonError,
      );
    }
  });

  it("rejects undefined object values, sparse arrays, and extra array properties", () => {
    assert.throws(
      () => canonicalJsonStringify({ value: undefined }),
      (error: unknown) =>
        error instanceof CanonicalJsonError
        && error.code === "CANONICAL_JSON_UNSUPPORTED_TYPE",
    );

    const sparse = new Array(2);
    sparse[1] = "present";
    assert.throws(
      () => canonicalJsonStringify(sparse),
      (error: unknown) =>
        error instanceof CanonicalJsonError
        && error.code === "CANONICAL_JSON_SPARSE_ARRAY",
    );

    const extended = ["value"] as string[] & { extra?: string };
    extended.extra = "hidden from JSON";
    assert.throws(
      () => canonicalJsonStringify(extended),
      (error: unknown) =>
        error instanceof CanonicalJsonError
        && error.code === "CANONICAL_JSON_ARRAY_PROPERTY",
    );
  });

  it("rejects cycles but permits repeated acyclic references", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.throws(
      () => canonicalJsonStringify(cyclic),
      (error: unknown) =>
        error instanceof CanonicalJsonError
        && error.code === "CANONICAL_JSON_CYCLE",
    );

    const shared = { stable: true };
    assert.equal(
      canonicalJsonStringify({ left: shared, right: shared }),
      '{"left":{"stable":true},"right":{"stable":true}}',
    );
  });

  it("rejects accessors, symbol properties, and non-enumerable properties", () => {
    const accessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => "side effect",
    });
    assert.throws(
      () => canonicalJsonStringify(accessor),
      (error: unknown) =>
        error instanceof CanonicalJsonError
        && error.code === "CANONICAL_JSON_ACCESSOR_PROPERTY",
    );

    const withSymbol = { value: 1 } as Record<PropertyKey, unknown>;
    withSymbol[Symbol("hidden")] = true;
    assert.throws(
      () => canonicalJsonStringify(withSymbol),
      (error: unknown) =>
        error instanceof CanonicalJsonError
        && error.code === "CANONICAL_JSON_SYMBOL_PROPERTY",
    );

    const withHidden = Object.defineProperty({ value: 1 }, "hidden", {
      enumerable: false,
      value: true,
    });
    assert.throws(
      () => canonicalJsonStringify(withHidden),
      (error: unknown) =>
        error instanceof CanonicalJsonError
        && error.code === "CANONICAL_JSON_NON_ENUMERABLE_PROPERTY",
    );
  });

  it("emits UTF-8 bytes without a trailing newline and hashes those exact bytes", () => {
    const value = { text: "contract", version: 1 };
    const bytes = canonicalJsonBytes(value);
    assert.equal(bytes.at(-1), "}".charCodeAt(0));
    assert.equal(bytes.includes("\n".charCodeAt(0)), false);
    assert.equal(
      hashCanonicalJson(value),
      createHash("sha256").update(bytes).digest("hex"),
    );
    assert.deepEqual(canonicalJsonBytes(value), bytes);
  });
});
