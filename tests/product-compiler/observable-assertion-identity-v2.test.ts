import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalizeObservableAssertionsV2 } from "../../src/product-compiler/observable-assertion-identity-v2.js";

describe("canonicalizeObservableAssertionsV2", () => {
  it("preserves complete values and duplicate entries without mutating the original authority", () => {
    // Sorting in place, deduplicating keys, or normalizing expected values would
    // corrupt the authority carried by these complete original assertions.
    const before = Object.freeze({
      phase: "before", property: "value", operator: "equals",
      expected: Object.freeze({ choices: Object.freeze(["z", "a"]), enabled: false, count: 0, empty: null }),
    });
    const after = Object.freeze({ phase: "after", property: "visible_text", operator: "contains", expected: "Start Game" });
    const duplicateKey = Object.freeze({ phase: "after", property: "visible_text", operator: "matches", expected: "^Start" });
    const changed = Object.freeze({ phase: "reload", property: "value", operator: "changed" });
    const input = Object.freeze([before, changed, after, duplicateKey, after]);
    const original = structuredClone(input);

    const actual = canonicalizeObservableAssertionsV2(input);

    assert.deepEqual(actual, [after, duplicateKey, after, before, changed]);
    assert.equal(actual.length, 5);
    [after, duplicateKey, after, before, changed].forEach((value, index) => {
      assert.equal(actual[index], value, "every complete original object survives unchanged");
    });
    assert.notEqual(actual, input);
    assert.deepEqual(input, original);
    assert.deepEqual(before.expected.choices, ["z", "a"]);
  });

  it("uses the existing graph UTF-16 phase/property comparator including ties", () => {
    // Literal order distinguishes phase-first ordering, property tie breaks,
    // stable ties, and UTF-16 comparison from locale or code-point sorting.
    const input = [
      { phase: "before", property: "visible_text", marker: 0 },
      { phase: "after", property: "visible_text", marker: 1 },
      { phase: "after", property: "enabled", marker: 2 },
      { phase: "after", property: "visibility", marker: 3 },
      { phase: "reload", property: "value", marker: 4 },
      { phase: "after", property: "enabled", marker: 5 },
      { phase: "after", property: "\u{10000}", marker: 6 },
      { phase: "after", property: "\ue000", marker: 7 },
    ];
    const actual = canonicalizeObservableAssertionsV2(input);
    assert.deepEqual(actual.map((value) => value.marker), [2, 5, 3, 1, 6, 7, 0, 4]);
    const oldGraphOrder = [...input].sort((left, right) => {
      const a = `${left.phase}\0${left.property}`;
      const b = `${right.phase}\0${right.property}`;
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    assert.deepEqual(actual, oldGraphOrder);
  });

  it("returns deterministic independent arrays for repeated and permuted unique keys", () => {
    const before = { phase: "before", property: "enabled", expected: true };
    const after = { phase: "after", property: "enabled", expected: false };
    const reload = { phase: "reload", property: "enabled", expected: true };
    const input = [before, reload, after];
    const first = canonicalizeObservableAssertionsV2(input);
    const second = canonicalizeObservableAssertionsV2(input);
    const permuted = canonicalizeObservableAssertionsV2([reload, after, before]);
    assert.deepEqual(first, [after, before, reload]);
    assert.deepEqual(second, first);
    assert.deepEqual(permuted, first);
    assert.deepEqual(canonicalizeObservableAssertionsV2(first), first);
    assert.notEqual(second, first);
    assert.deepEqual(input, [before, reload, after]);
    assert.deepEqual(canonicalizeObservableAssertionsV2([]), []);
  });
});
