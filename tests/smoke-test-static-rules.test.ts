import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  discoverHashRoutes,
  checkEntryPointImports,
  checkNativeButtonWiring,
  checkSemanticClickTargets,
  checkWeakInteractionAssertions,
} from "../scripts/smoke-test.mjs";

function withRepo(fn: (repo: string) => void) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-smoke-static-"));
  try {
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    fn(repo);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

describe("smoke-test static rules", () => {
  it("ignores type-only imports from TS entry points", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import type { AppView } from "./BottomNav";',
        'const current: AppView = "today";',
        "export function App() { return null; }",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "BottomNav.tsx"), 'export type AppView = "today" | "profile";\n');

      assert.deepEqual(checkEntryPointImports(repo), []);
    });
  });

  it("ignores inline type-only specifiers in mixed imports", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import { type AppView, makeView } from "./BottomNav";',
        'const current: AppView = makeView("today");',
        "export { current };",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "BottomNav.tsx"), [
        'export type AppView = "today" | "profile";',
        'export function makeView(view: AppView) { return view; }',
      ].join("\n"));

      assert.deepEqual(checkEntryPointImports(repo), []);
    });
  });

  it("does not treat type-only exports as runtime values", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import { AppView } from "./BottomNav";',
        "export const current = AppView;",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "BottomNav.tsx"), 'export { type AppView };\ntype AppView = "today" | "profile";\n');

      const issues = checkEntryPointImports(repo);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /imports "AppView".*but target does not export it/);
    });
  });

  it("resolves TypeScript barrel directory imports from index files", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import { MainMenu } from "./screens";',
        "export function App() { return <MainMenu />; }",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "index.ts"), 'export { MainMenu } from "./MainMenu";\n');

      assert.deepEqual(checkEntryPointImports(repo), []);
    });
  });

  it("does not invent hash routes for state-rendered screen directories", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import { MainMenu, GameOptions } from "./screens";',
        "export function App() {",
        "  const phase = 'menu';",
        "  return phase === 'menu' ? <MainMenu /> : <GameOptions />;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "MainMenu.tsx"), "export function MainMenu() { return null; }\n");
      fs.writeFileSync(path.join(repo, "src", "screens", "GameOptions.tsx"), "export function GameOptions() { return null; }\n");
      fs.writeFileSync(path.join(repo, "src", "screens", "index.ts"), [
        'export { MainMenu } from "./MainMenu";',
        'export { GameOptions } from "./GameOptions";',
      ].join("\n"));

      assert.deepEqual(discoverHashRoutes(repo), []);
    });
  });

  it("still derives screen hash routes when the app has explicit hash navigation", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        "  location.hash = '#settings';",
        "  return null;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "GameOptions.tsx"), "export function GameOptions() { return null; }\n");

      assert.deepEqual(discoverHashRoutes(repo).sort(), ["#game-options", "#settings"]);
    });
  });

  it("rejects data-smoke-ignore as a native button wiring bypass", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export function App() { return <button data-smoke-ignore>Profile</button>; }\n");

      const issues = checkNativeButtonWiring(repo);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /button "Profile" has no onClick\/type="submit"\/disabled\/aria-disabled/);
    });
  });

  it("allows intentionally unavailable native buttons only when disabled", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        '  return <><button disabled>Soon</button><button aria-disabled="true">Later</button></>;',
        "}",
      ].join("\n"));

      assert.deepEqual(checkNativeButtonWiring(repo), []);
    });
  });

  it("rejects non-semantic onClick targets", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        '  return <div onClick={() => {}}>Open settings</div>;',
        "}",
      ].join("\n"));

      const issues = checkSemanticClickTargets(repo);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /<div> has onClick but is not a native or keyboard-accessible control/);
    });
  });

  it("allows fully keyboard-accessible custom click targets", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        '  return <div role="button" tabIndex={0} onKeyDown={() => {}} onClick={() => {}}>Open settings</div>;',
        "}",
      ].join("\n"));

      assert.deepEqual(checkSemanticClickTargets(repo), []);
    });
  });

  it("rejects click tests that only assert not.toThrow", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.test.tsx"), [
        'import { fireEvent } from "@testing-library/react";',
        'it("settings button is clickable", () => {',
        "  const settings = document.createElement('button');",
        "  expect(() => fireEvent.click(settings)).not.toThrow();",
        "});",
      ].join("\n"));

      const issues = checkWeakInteractionAssertions(repo);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /click assertion uses not\.toThrow only/);
    });
  });

  it("keeps implement and verify prompts aligned with the button rule", () => {
    const implementPrompt = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/06-implement/prompt.md"), "utf-8");
    const smokeScript = fs.readFileSync(path.join(process.cwd(), "scripts/smoke-test.mjs"), "utf-8");
    const verifyScript = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/07-verify/playwright-check.ts"), "utf-8");

    assert.ok(implementPrompt.includes("Do not use `data-smoke-ignore`"));
    assert.equal(implementPrompt.includes("or explicit `data-smoke-ignore`"), false);
    assert.equal(smokeScript.includes('hasAttribute("data-smoke-ignore")'), false);
    assert.equal(verifyScript.includes("hasAttribute('data-smoke-ignore')"), false);
  });

  it("does not report stale DOM button references as dead buttons", () => {
    const smokeScript = fs.readFileSync(path.join(process.cwd(), "scripts/smoke-test.mjs"), "utf-8");

    assert.match(smokeScript, /!item\.btn\.isConnected\s*\|\|\s*skipButton\(item\.btn,\s*item\.label\)/);
  });

  it("exits successfully for warning-only smoke results", () => {
    const smokeScript = fs.readFileSync(path.join(process.cwd(), "scripts/smoke-test.mjs"), "utf-8");

    assert.match(smokeScript, /status: failures\.length === 0 \? 'pass' : \(confidence >= 70 \? 'warn' : 'fail'\)/);
    assert.match(smokeScript, /process\.exit\(result\.status === 'fail' \? 1 : 0\)/);
    assert.doesNotMatch(smokeScript, /process\.exit\(failures\.length > 0 \? 1 : 0\)/);
  });

  it("ignores SVGs hidden by responsive ancestors in visual smoke", () => {
    const smokeScript = fs.readFileSync(path.join(process.cwd(), "scripts/smoke-test.mjs"), "utf-8");

    assert.match(smokeScript, /function hiddenByAncestor/);
    assert.match(smokeScript, /if \(hiddenByAncestor\(svg\)\) return;/);
  });

  it("blocks QA-FIX completion while platform smoke still fails", () => {
    const guardSource = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/06-implement/guards.ts"), "utf-8");
    const stepOpsSource = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");

    assert.match(guardSource, /export function checkQaFixSmokeGate/);
    assert.match(guardSource, /QA_FIX_SMOKE_STILL_FAILING/);
    assert.match(guardSource, /scripts", "smoke-test\.mjs"/);
    assert.match(stepOpsSource, /checkQaFixSmokeGate\(storyRow\.story_id, storyRow\.title, wd\)/);
  });
});
