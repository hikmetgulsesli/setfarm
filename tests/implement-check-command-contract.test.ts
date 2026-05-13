import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

describe("implement check command contract", () => {
  it("forbids masked build/test pipelines in prompt and rules", () => {
    const prompt = read("src/installer/steps/06-implement/prompt.md");
    const rules = read("src/installer/steps/06-implement/rules.md");

    assert.match(prompt, /Do not pipe build\/test commands/i);
    assert.match(rules, /Do not decide build\/test success from commands piped through/i);

    for (const content of [prompt, rules]) {
      assert.match(content, /head.*tail.*grep.*tee.*cat/is);
      assert.match(content, /real exit (?:status|codes)/i);
    }
  });
});
