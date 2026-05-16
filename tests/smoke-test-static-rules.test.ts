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
  checkUnreachableStateScreens,
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

  it("does not treat href hash placeholders as explicit hash routing", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        "  return <a href=\"#\">Placeholder</a>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "GameOptions.tsx"), "export function GameOptions() { return null; }\n");

      assert.deepEqual(discoverHashRoutes(repo), []);
    });
  });

  it("ignores generated fallback design navigation hashes", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        'import { MainMenu } from "./screens";',
        "export function App() { return <MainMenu />; }",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "index.ts"), 'export { MainMenu } from "./MainMenu";\n');
      fs.writeFileSync(path.join(repo, "src", "screens", "MainMenu.tsx"), [
        "export function MainMenu() {",
        "  return <nav>",
        '    <a href="#fallback-main-menu">Main Menu</a>',
        '    <a href="#fallback-controls-help">Controls Help</a>',
        "  </nav>;",
        "}",
      ].join("\n"));

      assert.deepEqual(discoverHashRoutes(repo), []);
    });
  });

  it("does not derive short screen hashes from generated fallback screen indexes", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        "  window.addEventListener('hashchange', () => {});",
        "  location.hash = '#settings';",
        "  return null;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "fallback-main-menu", componentName: "MainMenu", file: "src/screens/MainMenu.tsx" },
        { screenId: "fallback-game-options", componentName: "GameOptions", file: "src/screens/GameOptions.tsx" },
      ]));
      fs.writeFileSync(path.join(repo, "src", "screens", "MainMenu.tsx"), "export function MainMenu() { return null; }\n");
      fs.writeFileSync(path.join(repo, "src", "screens", "GameOptions.tsx"), "export function GameOptions() { return null; }\n");

      assert.deepEqual(discoverHashRoutes(repo), ["#settings"]);
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

  it("rejects rendered phase screens whose transition action is never wired to UI", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "import { useAppState } from './useAppState';",
        "export function App() {",
        "  const { state, actions } = useAppState();",
        "  const phase = state.phase;",
        "  return <>",
        "    {phase === 'playing' && <button onClick={actions.pauseGame}>Pause</button>}",
        "    {phase === 'paused' && <button onClick={actions.resumeGame}>Resume</button>}",
        "    {phase === 'nextpiece' && <h1>Next Piece Preview</h1>}",
        "  </>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "useAppState.ts"), [
        "export function useAppState() {",
        "  const state = { phase: 'playing' };",
        "  const pauseGame = () => setState({ phase: 'paused' });",
        "  const resumeGame = () => setState({ phase: 'playing' });",
        "  const goToNextPiece = () => setState({ phase: 'nextpiece' });",
        "  return { state, actions: { pauseGame, resumeGame, goToNextPiece } };",
        "}",
      ].join("\n"));

      const issues = checkUnreachableStateScreens(repo);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /state "nextpiece".*goToNextPiece.*not wired/);
    });
  });

  it("allows rendered phase screens when the transition action is wired", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "import { useAppState } from './useAppState';",
        "export function App() {",
        "  const { state, actions } = useAppState();",
        "  const phase = state.phase;",
        "  return <>",
        "    {phase === 'playing' && <button onClick={actions.goToNextPiece}>Next Piece</button>}",
        "    {phase === 'nextpiece' && <button onClick={actions.resumeGame}>Back</button>}",
        "  </>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "useAppState.ts"), [
        "export function useAppState() {",
        "  const state = { phase: 'playing' };",
        "  const resumeGame = () => setState({ phase: 'playing' });",
        "  const goToNextPiece = () => setState({ phase: 'nextpiece' });",
        "  return { state, actions: { resumeGame, goToNextPiece } };",
        "}",
      ].join("\n"));

      assert.deepEqual(checkUnreachableStateScreens(repo), []);
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

  it("does not require a globally installed static server for smoke tests", () => {
    const smokeScript = fs.readFileSync(path.join(process.cwd(), "scripts/smoke-test.mjs"), "utf-8");

    assert.match(smokeScript, /function startServer/);
    assert.match(smokeScript, /startNodeStaticServer/);
    assert.match(smokeScript, /process\.execPath/);
    assert.match(smokeScript, /e\.code === 'ENOENT'/);
  });

  it("cleans up visual verification preview and browser process groups", () => {
    const verifyScript = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/07-verify/playwright-check.ts"), "utf-8");
    const supervisorVisualQa = fs.readFileSync(path.join(process.cwd(), "src/installer/supervisor/visual-qa.ts"), "utf-8");

    assert.match(verifyScript, /process\.kill\(-proc\.pid,\s*signal\)/);
    assert.match(verifyScript, /await stopPreviewServer\(server\.proc\)/);
    assert.match(verifyScript, /function execFileProcessGroup/);
    assert.match(verifyScript, /function cleanupDetachedPlaywrightChildren/);
    assert.match(verifyScript, /chromium_headless_shell\|playwright_chromiumdev_profile/);
    assert.match(verifyScript, /detached:\s*true/);
    assert.match(verifyScript, /finally \{ await browser\.close\(\)\.catch\(\(\) => \{\}\); \}/);

    assert.match(supervisorVisualQa, /process\.kill\(-proc\.pid,\s*signal\)/);
    assert.match(supervisorVisualQa, /await stopPreviewServer\(server\.proc\)/);
    assert.doesNotMatch(supervisorVisualQa, /setTimeout\(\(\) => \{\s*try \{\s*if \(proc\.pid\) process\.kill\(-proc\.pid,\s*"SIGKILL"\)/);
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
