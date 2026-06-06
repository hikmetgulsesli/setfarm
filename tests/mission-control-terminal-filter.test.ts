import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");

describe("Mission Control terminal run visibility", () => {
  it("filters terminal failed/cancelled runs by default at the API boundary", () => {
    const source = fs.readFileSync(path.join(root, "src", "server", "dashboard.ts"), "utf-8");
    assert.match(source, /function isTerminalRunStatus/);
    assert.match(source, /\["failed", "cancelled", "canceled", "error"\]/);
    assert.match(source, /if \(!options\.includeTerminal && isTerminalRunStatus\(r\.status\)\) continue/);
    assert.match(source, /include_terminal/);
    assert.match(source, /getRuns\(wf, \{ includeTerminal \}\)/);
  });

  it("keeps terminal runs accessible behind an explicit Mission Control toggle", () => {
    const html = fs.readFileSync(path.join(root, "src", "server", "index.html"), "utf-8");
    assert.match(html, /let showTerminalRuns = false/);
    assert.match(html, /id="terminal-toggle"/);
    assert.match(html, /function toggleTerminalRuns\(checked\)/);
    assert.match(html, /include_terminal=1/);
    assert.match(html, /Show terminal/);
  });
});
