import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

import {
  ENGLISH_TEXT_ARRAY_INDEX_V1,
  ENGLISH_TEXT_DESCENDANT_V1,
  englishTextViolationMessageV1,
  inspectEnglishTextTreeV1,
  inspectEnglishTextV1,
} from "../../src/product-compiler/english-text-contract-v1.js";

describe("English text contract v1", () => {
  const asciiText = (codeUnits: readonly number[]): string => String.fromCharCode(...codeUnits);

  it("accepts printable ASCII English text and structural whitespace", () => {
    assert.equal(inspectEnglishTextV1("Ready preference\nSave settings\t/status\r\n"), undefined);
  });

  it("rejects a non-English marker suffix without reproducing it", () => {
    const markerBypass = `English marker ${String.fromCodePoint(0x0416)}`;
    const issue = inspectEnglishTextV1(markerBypass);

    assert.equal(issue?.code, "ENGLISH_TEXT_NON_ASCII");
    assert.equal(issue?.codeUnit, 0x0416);
    assert.equal(englishTextViolationMessageV1(issue!), "ENGLISH_TEXT_NON_ASCII at / code unit 0x0416");
    assert.equal(englishTextViolationMessageV1(issue!).includes(markerBypass), false);
  });

  it("rejects high-signal ASCII localized UI copy without reproducing it", () => {
    const first = asciiText([71, 117, 97, 114, 100, 97, 114, 32, 99, 97, 109, 98, 105, 111, 115]);
    const second = asciiText([71, 111, 114, 101, 118, 108, 101, 114, 105, 32, 107, 97, 121, 100, 101, 116]);

    for (const value of [first, second]) {
      const issue = inspectEnglishTextV1(value);
      assert.equal(issue?.code, "ENGLISH_TEXT_UNSUPPORTED_LEXEME");
      assert.equal(englishTextViolationMessageV1(issue!).includes(value), false);
    }
  });

  it("applies lexical admission only to explicit prose fields", () => {
    const localizedToken = asciiText([103, 117, 97, 114, 100, 97, 114]);
    const lexicalPathPatterns = [
      ["actions", ENGLISH_TEXT_ARRAY_INDEX_V1, "name"],
      [
        "actions",
        ENGLISH_TEXT_ARRAY_INDEX_V1,
        "preconditions",
        ENGLISH_TEXT_ARRAY_INDEX_V1,
        "expected",
        ENGLISH_TEXT_DESCENDANT_V1,
      ],
    ] as const;
    assert.deepEqual(
      inspectEnglishTextTreeV1(
        { actions: [{ input: { fields: [{ name: localizedToken }] } }] },
        { lexicalPathPatterns },
      ),
      [],
    );
    assert.equal(
      inspectEnglishTextTreeV1(
        { actions: [{ name: localizedToken }] },
        { lexicalPathPatterns },
      )[0]?.code,
      "ENGLISH_TEXT_UNSUPPORTED_LEXEME",
    );
    assert.equal(
      inspectEnglishTextTreeV1(
        { actions: [{ preconditions: [{ expected: { value: localizedToken } }] }] },
        { lexicalPathPatterns },
      )[0]?.code,
      "ENGLISH_TEXT_UNSUPPORTED_LEXEME",
    );

    assert.equal(
      inspectEnglishTextTreeV1(
        { $key: localizedToken },
        { lexicalPathPatterns: [["$key"]] },
      )[0]?.code,
      "ENGLISH_TEXT_UNSUPPORTED_LEXEME",
    );
  });

  it("keeps opaque source evidence exact while charging global budgets", () => {
    const localizedEvidence = `source ${String.fromCodePoint(0x0416)}`;
    const opaquePathPatterns = [["requirements", ENGLISH_TEXT_ARRAY_INDEX_V1, "normalizedClause"]] as const;
    const input = { requirements: [{ normalizedClause: localizedEvidence }] };

    assert.deepEqual(inspectEnglishTextTreeV1(input, { opaquePathPatterns }), []);
    assert.equal(input.requirements[0]!.normalizedClause, localizedEvidence);
    assert.equal(
      inspectEnglishTextTreeV1(input, {
        opaquePathPatterns,
        maxTotalCodeUnits: localizedEvidence.length - 1,
      })[0]?.code,
      "ENGLISH_TEXT_TREE_LIMIT_EXCEEDED",
    );
    assert.equal(
      inspectEnglishTextTreeV1(input, {
        opaquePathPatterns,
        maxCodeUnitsPerValue: localizedEvidence.length - 1,
      })[0]?.code,
      "ENGLISH_TEXT_VALUE_LIMIT_EXCEEDED",
    );
  });

  it("accepts technical identifiers, locators, hashes, and English UI copy", () => {
    for (const value of [
      "ACT_SAVE_RECORD",
      "task/input.txt#chars=0-10",
      "vite-react",
      "a".repeat(64),
      "/preferences",
      "Save changes",
      `Planner${String.fromCodePoint(0x2019)}s summary ${String.fromCodePoint(0x2014)} ready`,
    ]) {
      assert.equal(inspectEnglishTextV1(value), undefined, value);
    }
  });

  it("reports exact nested paths and enforces value, tree, and visit bounds", () => {
    const nested = inspectEnglishTextTreeV1({
      product: { name: `Ready ${String.fromCodePoint(0x03a9)}` },
    });
    assert.deepEqual(nested[0]?.path, ["product", "name"]);

    assert.equal(inspectEnglishTextV1("abcd", 3)?.code, "ENGLISH_TEXT_VALUE_LIMIT_EXCEEDED");
    assert.equal(inspectEnglishTextTreeV1(["ab", "cd"], { maxTotalCodeUnits: 3 })[0]?.code,
      "ENGLISH_TEXT_TREE_LIMIT_EXCEEDED");
    assert.equal(inspectEnglishTextTreeV1(["a", "b"], { maxVisitedValues: 2 })[0]?.code,
      "ENGLISH_TEXT_TREE_LIMIT_EXCEEDED");

    const manyKeys = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`k${index}`, index]));
    assert.equal(
      inspectEnglishTextTreeV1(manyKeys, { maxVisitedValues: 5 })[0]?.code,
      "ENGLISH_TEXT_TREE_LIMIT_EXCEEDED",
    );

    const hostilePrototype = Object.create(Object.fromEntries(
      Array.from({ length: 64 }, (_, index) => [`inherited${index}`, index]),
    )) as Record<string, unknown>;
    hostilePrototype.own = "Ready";
    assert.equal(
      inspectEnglishTextTreeV1(hostilePrototype, { maxVisitedValues: 5 })[0]?.code,
      "ENGLISH_TEXT_OBJECT_PROTOTYPE_INVALID",
    );

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.equal(
      inspectEnglishTextTreeV1(cyclic)[0]?.code,
      "ENGLISH_TEXT_OBJECT_REFERENCE_REUSED",
    );

    const shared = { value: "Ready" };
    assert.equal(
      inspectEnglishTextTreeV1({ first: shared, second: shared })[0]?.code,
      "ENGLISH_TEXT_OBJECT_REFERENCE_REUSED",
    );

    let deep: Record<string, unknown> = { value: "Ready" };
    for (let index = 0; index < 16; index += 1) deep = { child: deep };
    assert.equal(
      inspectEnglishTextTreeV1(deep, { maxDepth: 8 })[0]?.code,
      "ENGLISH_TEXT_TREE_DEPTH_EXCEEDED",
    );

    const accessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get(): never {
        throw new Error("ACCESSOR_MUST_NOT_RUN");
      },
    });
    assert.equal(
      inspectEnglishTextTreeV1(accessor)[0]?.code,
      "ENGLISH_TEXT_OBJECT_PROPERTY_INVALID",
    );

    assert.equal(
      inspectEnglishTextTreeV1("ab", { maxCodeUnitsPerValue: Number.POSITIVE_INFINITY })[0]?.code,
      "ENGLISH_TEXT_VALUE_LIMIT_EXCEEDED",
    );
    assert.equal(
      inspectEnglishTextV1("ab", Number.POSITIVE_INFINITY)?.code,
      "ENGLISH_TEXT_VALUE_LIMIT_EXCEEDED",
    );

    const source = fs.readFileSync("src/product-compiler/english-text-contract-v1.ts", "utf-8");
    assert.equal(source.includes("Object.entries(current.value"), false);
    assert.match(source, /enumeratedKeys \+= 1;[\s\S]*enumeratedKeys \* 2 > remainingValues/);
    assert.equal(source.includes('current.path[current.path.length - 1] !== "$key"'), false);
    assert.equal(source.includes("path: [...current.path"), false);
  });
});
