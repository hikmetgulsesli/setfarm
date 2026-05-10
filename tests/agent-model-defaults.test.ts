import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

function installSource(): string {
  return readFileSync(path.resolve("src", "installer", "install.ts"), "utf-8");
}

describe("workflow agent model defaults", () => {
  it("keeps Setfarm product workflow roles Kimi-first by default", () => {
    const source = installSource();
    const start = source.indexOf("function defaultModelForAgent(");
    const end = source.indexOf("function upsertAgent(", start);
    assert.notEqual(start, -1, "defaultModelForAgent source not found");
    assert.notEqual(end, -1, "defaultModelForAgent end marker not found");
    const fn = source.slice(start, end);

    assert.match(fn, /return \{ \.\.\.KIMI_FIRST_AGENT_MODEL \};/);
    assert.match(fn, /\["security-gate", "setup-build", "setup-repo"\]\.includes\(localId\)/);
    assert.match(fn, /return \{ \.\.\.MINIMAX_AGENT_MODEL \};/);
    assert.doesNotMatch(fn, /\["developer", "planner"\]\.includes\(localId\)/);
  });
});
