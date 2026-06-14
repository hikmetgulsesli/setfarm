import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function makeRepo(prefix: string): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
  fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
  return repo;
}

function writeHtml(filePath: string, body: string): void {
  const filler = "<p>design-token</p>".repeat(80);
  fs.writeFileSync(filePath, `<!doctype html><html><body>${body}${filler}</body></html>`);
}

describe("immutable design import invariants", () => {
  it("keeps stitch-to-jsx build-safe on unknown Material Symbols and records supervisor-fixable evidence", () => {
    const repo = makeRepo("setfarm-design-import-invariant-icon-");
    try {
      fs.writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "toolbar-screen", title: "Toolbar Screen" },
      ]));
      writeHtml(path.join(repo, "stitch", "toolbar-screen.html"), `
        <main><button><span class="material-symbols-outlined">not_a_real_material_symbol</span></button></main>
      `);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", repo], { cwd: process.cwd(), stdio: "pipe" });
      const report = JSON.parse(fs.readFileSync(path.join(repo, ".setfarm", "setup", "UNKNOWN_MATERIAL_ICONS.json"), "utf-8"));
      assert.equal(report.status, "warning");
      assert.equal(report.severity, "supervisor_fixable");
      assert.deepEqual(report.icons, [{ iconName: "not_a_real_material_symbol", count: 1 }]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails generated-screen-validator when SCREEN_MAP coverage is incomplete", () => {
    const repo = makeRepo("setfarm-design-import-invariant-coverage-");
    try {
      fs.writeFileSync(path.join(repo, "stitch", "SCREEN_MAP.json"), JSON.stringify([
        { screenId: "gameplay-1", name: "Gameplay" },
        { screenId: "settings-1", name: "Settings" },
      ]));
      fs.writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "gameplay-1": { screenId: "gameplay-1", buttons: [{ label: "Start" }] },
          "settings-1": { screenId: "settings-1", buttons: [{ label: "Save Preferences" }] },
        },
      }));
      fs.writeFileSync(path.join(repo, "src", "screens", "Gameplay.tsx"), [
        "export function Gameplay() {",
        "  return <main><button type=\"button\">Start</button></main>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "gameplay-1", title: "Gameplay", componentName: "Gameplay", file: "src/screens/Gameplay.tsx", actions: [] },
      ]));

      assert.throws(
        () => execFileSync("node", ["scripts/generated-screen-validator.mjs", repo], { cwd: process.cwd(), stdio: "pipe" }),
        /DESIGN_IMPORT_SCREEN_COVERAGE_MISSING/,
      );
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
