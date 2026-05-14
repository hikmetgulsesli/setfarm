import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("reviewer AGENTS.md browser verification", () => {
  const agentsMdPath = resolve(import.meta.dirname, "../workflows/feature-dev/agents/reviewer/AGENTS.md");

  it("reviewer AGENTS.md file exists", () => {
    assert.ok(existsSync(agentsMdPath), "reviewer AGENTS.md should exist");
  });

  it("contains review-related instructions", () => {
    if (!existsSync(agentsMdPath)) return;
    const content = readFileSync(agentsMdPath, "utf-8");
    assert.ok(content.length > 50, "AGENTS.md should have substantial content");
  });

  it("keeps verify as a bounded gate instead of a fixer", () => {
    if (!existsSync(agentsMdPath)) return;
    const content = readFileSync(agentsMdPath, "utf-8");
    assert.match(content, /bounded PR gate/i);
    assert.match(content, /deterministic evidence first/i);
    assert.match(content, /Do not fix code in verify/i);
    assert.match(content, /STATUS: retry/);
    assert.match(content, /STATUS: done` is allowed only after the PR is actually merged/i);
    assert.doesNotMatch(content, /verify` \(code review \+ fix \+ merge\)/i);
    assert.doesNotMatch(content, /If any fail: fix the issue, commit, push/i);
  });
});
