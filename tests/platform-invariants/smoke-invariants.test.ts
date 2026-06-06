import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkBrowserGameStaticContracts,
  checkNativeButtonWiring,
  checkWeakInteractionAssertions,
} from "../../scripts/smoke-test.mjs";

function withRepo(fn: (repo: string) => void) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-smoke-invariant-"));
  try {
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    fn(repo);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

describe("immutable smoke invariants", () => {
  it("rejects clickable controls that have no real native button wiring", () => {
    withRepo((repo) => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        "  return <button>Start Game</button>;",
        "}",
      ].join("\n"));

      const issues = checkNativeButtonWiring(repo);
      assert.ok(issues.some((issue) => /has no onClick/.test(issue)));
    });
  });

  it("rejects browser games that expose only static visual placeholders", () => {
    withRepo((repo) => {
      fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "stitch", "SCREEN_MAP.json"), JSON.stringify([
        { screenId: "gameplay-1", name: "Gameplay", type: "game", surfaceIds: ["SURF_GAMEPLAY"] },
      ]));
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import { Gameplay } from "./screens/Gameplay";',
        "export function App() {",
        '  return <div data-setfarm-root="game" className="min-h-screen bg-background"><Gameplay runtime={{ status: "ready", score: 0 }} /></div>;',
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([
        { title: "Gameplay", componentName: "Gameplay", file: "src/screens/Gameplay.tsx" },
      ]));
      fs.writeFileSync(path.join(repo, "src", "screens", "Gameplay.tsx"), [
        "export function Gameplay({ runtime }) {",
        '  return <main className="relative w-full max-w-[1200px] aspect-video m-playfield-margin overflow-hidden">',
        '    <div className="absolute w-4 h-4 top-1/2 left-1/3 rounded-full" />',
        '    <div className="absolute bottom-8 left-1/2 w-32 h-4" />',
        "  </main>;",
        "}",
      ].join("\n"));

      const issues = checkBrowserGameStaticContracts(repo);
      assert.ok(issues.some((issue) => issue.includes("gameplay surface is boxed")));
      assert.ok(issues.some((issue) => issue.includes("static CSS placeholders")));
    });
  });

  it("rejects browser-game roots that do not provide a complete viewport frame", () => {
    withRepo((repo) => {
      fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        '  return <div data-setfarm-root="game" className="min-h-screen"><button>Settings</button></div>;',
        "}",
      ].join("\n"));

      const issues = checkBrowserGameStaticContracts(repo);
      assert.ok(issues.some((issue) => /full viewport frame/.test(issue)));
    });
  });

  it("rejects click tests that can pass without post-click evidence", () => {
    withRepo((repo) => {
      fs.writeFileSync(path.join(repo, "src", "App.test.tsx"), [
        'import { fireEvent } from "@testing-library/react";',
        'it("settings button is clickable", () => {',
        "  const settings = document.createElement('button');",
        "  expect(() => fireEvent.click(settings)).not.toThrow();",
        "});",
      ].join("\n"));

      const issues = checkWeakInteractionAssertions(repo);
      assert.ok(issues.some((issue) => /not\.toThrow only/.test(issue)));
    });
  });
});
