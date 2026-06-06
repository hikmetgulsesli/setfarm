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
  checkUnknownActionFallbacks,
  checkBrowserGameStaticContracts,
  checkWeakInteractionAssertions,
  countSourceControlUsages,
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

  it("does not treat app state navigate calls as hash routes", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        "  const actions = { navigate(screen) { return screen; } };",
        "  return <button onClick={() => actions.navigate('settings')}>Settings</button>;",
        "}",
      ].join("\n"));

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

  it("allows rendered state screens when a visible generated action maps through a handler to the transition", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "import { startGame, openSettings } from './actions';",
        "export function App({ store }) {",
        "  const screen = store.screen;",
        "  const handleStartSequence = () => { startGame(); };",
        "  const handleSettings = () => { openSettings(); };",
        "  const gameplayActions = { 'start-sequence-1': handleStartSequence };",
        "  const settingsActions = { 'settings-3': handleSettings };",
        "  return <div>",
        "    {screen === 'gameplay' && <Gameplay actions={gameplayActions} />}",
        "    {screen === 'settings' && <Settings actions={settingsActions} />}",
        "    {screen === 'menu' && <button data-action-id=\"start-sequence-1\" onClick={handleStartSequence}>Start</button>}",
        "    <button data-action-id=\"settings-3\" onClick={handleSettings}>Settings</button>",
        "  </div>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens.tsx"), [
        "export function Gameplay({ actions }) {",
        "  return <button data-action-id=\"start-sequence-1\" onClick={actions?.['start-sequence-1']}>Start</button>;",
        "}",
        "export function Settings({ actions }) {",
        "  return <button data-action-id=\"settings-3\" onClick={actions?.['settings-3']}>Settings</button>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "actions.ts"), [
        "export function startGame() {",
        "  setState({ screen: 'gameplay' });",
        "}",
        "export function openSettings() {",
        "  setState({ screen: 'settings' });",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "store.ts"), [
        "export const store = { screen: 'menu' };",
      ].join("\n"));

      assert.deepEqual(checkUnreachableStateScreens(repo), []);
    });
  });

  it("does not treat reducer state assignments as user transition handlers", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App({ state }) {",
        "  return state.activeScreen === 'editor' ? <h1>Editor</h1> : <button>Create</button>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "store.ts"), [
        "export function reduceShiftLedgerLiteState(state, action) {",
        "  if (action.type === 'openEditor') return { ...state, activeScreen: 'editor' };",
        "  return state;",
        "}",
      ].join("\n"));

      assert.deepEqual(checkUnreachableStateScreens(repo), []);
    });
  });

  it("does not treat initial state factories as user transition handlers", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App({ store }) {",
        "  return store.screen === 'boot' ? <button onClick={store.startGame}>Start</button> : <h1>Game</h1>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "store.ts"), [
        "export function createInitialState() {",
        "  return { screen: 'boot' };",
        "}",
      ].join("\n"));

      assert.deepEqual(checkUnreachableStateScreens(repo), []);
    });
  });

  it("rejects unknown generated action fallbacks to invisible panel state", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "const actionDispatch = {};",
        "function dispatch(action) { return action; }",
        "export function runAction(id: string) {",
        "  const action = actionDispatch[id] ?? { type: 'panel', panel: id };",
        "  dispatch(action);",
        "}",
      ].join("\n"));

      const issues = checkUnknownActionFallbacks(repo);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /unknown action IDs fall back to a generic panel state/);
    });
  });

  it("allows explicit generated action mappings without a generic fallback", () => {
    withRepo(repo => {
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "const actionDispatch = {",
        "  'support-6': { type: 'panel', panel: 'support' },",
        "  'create-record-2': { type: 'openEditor' },",
        "};",
        "function dispatch(action) { return action; }",
        "export function runAction(id: string) {",
        "  const action = actionDispatch[id];",
        "  if (!action) dispatch({ type: 'storageError', message: id });",
        "  else dispatch(action);",
        "}",
      ].join("\n"));

      assert.deepEqual(checkUnknownActionFallbacks(repo), []);
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
    assert.match(supervisorVisualQa, /function cleanupDetachedPlaywrightChildren/);
    assert.match(supervisorVisualQa, /chromium_headless_shell\|playwright_chromiumdev_profile/);
    assert.match(supervisorVisualQa, /cleanupDetachedPlaywrightChildren\("visual-qa-finally"\)/);
    assert.match(supervisorVisualQa, /ownership\.titleToStory\.get\(normalizeOwnedScreenTitle\(title\)\) \|\| ownership\.fileToStory\.get\(file\)/);
    assert.match(supervisorVisualQa, /!fileToStory\.has\(rel\)\) fileToStory\.set\(rel, storyId\)/);
    assert.match(supervisorVisualQa, /readVisualScreenHints\(params\.repoPath, \[params\.workdir, params\.ownershipRepoPath \|\| ""\]\)/);
    assert.match(supervisorVisualQa, /actionIds:\s*\(screen\.actions \|\| \[\]\)\.map/);
    assert.match(supervisorVisualQa, /actionId:\s*el\.getAttribute\("data-action-id"\)/);
    assert.match(supervisorVisualQa, /ownerByAction\s*=\s*descriptor\.actionId/);
    assert.match(supervisorVisualQa, /ownerByAction\?\.storyId && ownerByAction\.storyId !== params\.storyId/);
    assert.match(supervisorVisualQa, /data-action-id=\$\{JSON\.stringify\(descriptor\.actionId\)\}/);
    assert.match(supervisorVisualQa, /visibleControlCount\s*=\s*await page\.locator\(CONTROL_SELECTOR\)\.count\(\)/);
    assert.match(supervisorVisualQa, /descriptor\.index\s*>=\s*visibleControlCount/);
    assert.match(supervisorVisualQa, /"--strictPort"/);
    assert.doesNotMatch(supervisorVisualQa, /setTimeout\(\(\) => \{\s*try \{\s*if \(proc\.pid\) process\.kill\(-proc\.pid,\s*"SIGKILL"\)/);
  });

  it("ignores SVGs hidden by responsive ancestors in visual smoke", () => {
    const smokeScript = fs.readFileSync(path.join(process.cwd(), "scripts/smoke-test.mjs"), "utf-8");

    assert.match(smokeScript, /function hiddenByAncestor/);
    assert.match(smokeScript, /if \(hiddenByAncestor\(svg\)\) return;/);
  });

  it("blocks repeated tiled game scenes and non-viewport roots in smoke", () => {
    const smokeScript = fs.readFileSync(path.join(process.cwd(), "scripts/smoke-test.mjs"), "utf-8");

    assert.match(smokeScript, /Phase 8b: Viewport Integrity/);
    assert.match(smokeScript, /\[VIEWPORT\]/);
    assert.match(smokeScript, /tiled-scene/);
    assert.match(smokeScript, /css-tiled-background/);
    assert.match(smokeScript, /backgroundSize/);
    assert.match(smokeScript, /game-scene-not-viewport/);
    assert.match(smokeScript, /viewportIssues: viewportCount/);
    assert.match(smokeScript, /confidence -= 35/);
  });

  it("blocks browser games with boxed static gameplay surfaces", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
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
      assert.ok(issues.some(issue => issue.includes("gameplay surface is boxed")));
      assert.ok(issues.some(issue => issue.includes("static CSS placeholders")));
    });
  });

  it("blocks browser games whose app root only declares partial viewport sizing", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        '  return <div data-setfarm-root="game" className="min-h-screen bg-background"><button>Settings</button></div>;',
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([]));

      const issues = checkBrowserGameStaticContracts(repo);
      assert.ok(issues.some(issue => issue.includes("full viewport frame")));

      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App() {",
        '  return <div data-setfarm-root="game" className="relative min-h-screen w-full overflow-hidden bg-background"><button>Settings</button></div>;',
        "}",
      ].join("\n"));

      assert.equal(
        checkBrowserGameStaticContracts(repo).some(issue => issue.includes("full viewport frame")),
        false,
      );
    });
  });

  it("blocks browser games whose moving runtime state is not rendered into gameplay objects", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([
        { title: "Gameplay", componentName: "Gameplay", file: "src/screens/Gameplay.tsx" },
      ]));
      fs.writeFileSync(path.join(repo, "src", "screens", "Gameplay.tsx"), [
        "export function Gameplay({ runtime }: { runtime?: { player?: { lane?: number; position?: number }; score?: number } }) {",
        '  return <main className="relative w-full h-screen overflow-hidden">',
        '    <div className="absolute top-1/2 left-1/3 w-8 h-8 rounded-full" />',
        '    <span>{runtime?.score}</span>',
        "  </main>;",
        "}",
      ].join("\n"));

      const issues = checkBrowserGameStaticContracts(repo);
      assert.ok(issues.some(issue => issue.includes("moving position state")));
    });
  });

  it("allows browser games that position visible entities from runtime state", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([
        { title: "Gameplay", componentName: "Gameplay", file: "src/screens/Gameplay.tsx" },
      ]));
      fs.writeFileSync(path.join(repo, "src", "screens", "Gameplay.tsx"), [
        "export function Gameplay({ runtime }: { runtime?: { player?: { lane?: number; position?: number }; score?: number } }) {",
        "  const player = runtime?.player || { lane: 1, position: 20 };",
        '  return <main className="relative w-full h-screen overflow-hidden">',
        '    <div className="absolute w-8 h-8 rounded-full" style={{ left: `${player.position}%`, top: `${player.lane * 33}%` }} />',
        '    <span>{runtime?.score}</span>',
        "  </main>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App({ actions }) {",
        "  setInterval(() => actions.tick(), 100);",
        "  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') actions.openSettings(); });",
        '  return <div data-setfarm-root="game" className="relative min-h-screen w-full overflow-hidden"><Gameplay /></div>;',
        "}",
      ].join("\n"));

      assert.deepEqual(checkBrowserGameStaticContracts(repo), []);
    });
  });

  it("allows browser games whose requestAnimationFrame loop dispatches TICK actions", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([
        { title: "Gameplay", componentName: "Gameplay", file: "src/screens/Gameplay.tsx" },
      ]));
      fs.writeFileSync(path.join(repo, "src", "screens", "Gameplay.tsx"), [
        "export function Gameplay({ runtime }: { runtime?: { player?: { lane?: number; position?: number }; score?: number } }) {",
        "  const player = runtime?.player || { lane: 1, position: 20 };",
        '  return <main className="relative w-full h-screen overflow-hidden">',
        '    <div className="absolute w-8 h-8 rounded-full" style={{ left: `${player.position}%`, top: `${player.lane * 33}%` }} />',
        '    <button>Settings</button>',
        "  </main>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App({ dispatch }) {",
        "  requestAnimationFrame(function loop() {",
        "    dispatch({ type: 'TICK', delta: 16 });",
        "    requestAnimationFrame(loop);",
        "  });",
        "  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') dispatch({ type: 'OPEN_SETTINGS' }); });",
        '  return <div data-setfarm-root="game" className="relative min-h-screen w-full overflow-hidden"><Gameplay /></div>;',
        "}",
      ].join("\n"));

      assert.deepEqual(checkBrowserGameStaticContracts(repo), []);
    });
  });

  it("blocks browser game settings overlays that replace gameplay instead of layering above it", () => {
    withRepo(repo => {
      fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), [
        "export function App({ activeScreen }) {",
        '  return activeScreen === "settings" ? (<GameSettings />) : (<Gameplay />);',
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([
        { title: "Gameplay", componentName: "Gameplay", file: "src/screens/Gameplay.tsx" },
        { title: "Game Settings", componentName: "GameSettings", file: "src/screens/GameSettings.tsx" },
      ]));
      fs.writeFileSync(path.join(repo, "src", "screens", "Gameplay.tsx"), [
        "export function Gameplay({ runtime }: { runtime?: { player?: { lane?: number; position?: number } } }) {",
        "  const player = runtime?.player || { lane: 1, position: 20 };",
        '  return <main className="relative w-full h-screen overflow-hidden"><div style={{ left: `${player.position}%`, top: `${player.lane * 33}%` }} /></main>;',
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src", "screens", "GameSettings.tsx"), [
        "export function GameSettings() {",
        '  return <main><div className="absolute inset-0 backdrop-blur-sm" /><section className="modal">Settings</section></main>;',
        "}",
      ].join("\n"));

      const issues = checkBrowserGameStaticContracts(repo);
      assert.ok(issues.some(issue => issue.includes("overlay replaces gameplay")));
    });
  });

  it("documents that browser-game smoke cannot pass with zero interactions", () => {
    const smokeScript = fs.readFileSync(path.join(process.cwd(), "scripts/smoke-test.mjs"), "utf-8");
    assert.match(smokeScript, /browser-game-zero-interactions/);
    assert.match(smokeScript, /buttonsChecked \+ formsChecked \+ flowsChecked === 0/);
  });

  it("blocks QA-FIX completion while platform smoke still fails", () => {
    const guardSource = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/06-implement/guards.ts"), "utf-8");
    const stepOpsSource = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");

    assert.match(guardSource, /export function checkQaFixSmokeGate/);
    assert.match(guardSource, /QA_FIX_SMOKE_STILL_FAILING/);
    assert.match(guardSource, /resolvePlatformScript\("smoke-test\.mjs"\)/);
    assert.match(stepOpsSource, /checkQaFixSmokeGate\(storyRow\.story_id, storyRow\.title, wd\)/);
  });

  it("counts data-action-id links as design action controls", () => {
    const counts = countSourceControlUsages([
      '<button type="button" data-action-id="pause" onClick={pause}>Pause</button>',
      '<a href="#" data-action-id="settings" onClick={openSettings}>Settings</a>',
      '<div data-action-id="decorative">Decorative</div>',
      '<span role="button" data-action-id="help">Help</span>',
    ].join("\n"));

    assert.equal(counts.buttons, 3);
  });
});
