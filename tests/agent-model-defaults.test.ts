import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

function installSource(): string {
  return readFileSync(path.resolve("src", "installer", "install.ts"), "utf-8");
}

describe("workflow agent model defaults", () => {
  it("keeps Setfarm workflow roles on MiniMax M3 with Kimi fallback", () => {
    const source = installSource();
    const start = source.indexOf("function defaultModelForAgent(");
    const end = source.indexOf("function upsertAgent(", start);
    assert.notEqual(start, -1, "defaultModelForAgent source not found");
    assert.notEqual(end, -1, "defaultModelForAgent end marker not found");
    const fn = source.slice(start, end);

    assert.match(source, /const MINIMAX_OPENAI_MODEL_REF = `\$\{MINIMAX_OPENAI_PROVIDER_ID\}\/MiniMax-M3`/);
    assert.match(source, /const CODEX_DEFAULT_MODEL_REF = "default"/);
    assert.match(source, /fallbacks: \[KIMI_CODING_MODEL_REF, CODEX_DEFAULT_MODEL_REF\]/);
    assert.doesNotMatch(source, /MINIMAX_OPENAI_LEGACY_MODEL_REF/);
    assert.doesNotMatch(source, /MiniMax-M2\.7/);
    assert.match(fn, /return \{ \.\.\.MINIMAX_FIRST_AGENT_MODEL \};/);
    assert.doesNotMatch(fn, /security-gate/);
    assert.doesNotMatch(fn, /setup-build/);
    assert.doesNotMatch(fn, /setup-repo/);
  });
});
