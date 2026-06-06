import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { implementModule } from "../../dist/installer/steps/06-implement/module.js";
import { checkBuildGate, checkGeneratedRuntimeSemanticGate, checkGeneratedScreenRequiredPropsGate, checkGeneratedScreenShellChromeGate, checkImplementEvidenceGate, checkPlatformHelperContaminationGate, checkScopeEnforcement, checkScopeFilesGate, checkTestGate, computeScopeFileLimits, detectPackageBuildCommand, findDesignDomImplementationFindings, findDesignDomImplementationIssues, findGeneratedRuntimeSemanticIssues, findGeneratedScreenIntegrationIssues, findGeneratedScreenRegressionIssues, findGeneratedScreenRequiredPropIssues, findGeneratedScreenShellChromeIssues, findPlatformHelperContaminationIssues, getOutOfScopeStoryFiles, normalize, parseGitStatusPorcelainPath, selectMatchingStoryWorktree, sourceExposesWindowApp, validateOutput } from "../../dist/installer/steps/06-implement/guards.js";
import { buildScopeFilesRetryFailureForWorkdir, cleanupOutOfScopeWorktreeFiles, mergeRetryFailureTexts } from "../../dist/installer/steps/06-implement/context.js";
import { cleanupBlockedStoryCommitScope, commitStoryWorktreeScopeIfNeeded, decideStorySystemSmokeGate } from "../../dist/installer/step-ops.js";
import { createStoryWorktree, ensureStoryBranchWorktree } from "../../dist/installer/worktree-ops.js";
import { assembleImplementContext, fileTreeManifestPath, setupCertificatePath, sharedGrantsPath } from "../../dist/installer/setup-handoff.js";
import { IMPLICIT_STORY_SCOPE_FILES, isImplicitStoryScopeFile } from "../../dist/installer/story-scope.js";
import { checkStoryDesignCompliance } from "../../dist/installer/step-guardrails.js";
import { STACK_RULES } from "../../dist/installer/steps/06-implement/stack-rules.js";
import { pgRun } from "../../dist/db-pg.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 10000,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Setfarm Test",
      GIT_AUTHOR_EMAIL: "setfarm-test@example.test",
      GIT_COMMITTER_NAME: "Setfarm Test",
      GIT_COMMITTER_EMAIL: "setfarm-test@example.test",
    },
  }).trim();
}

describe("06-implement step module", () => {
  it("module metadata is correct", () => {
    assert.equal(implementModule.id, "implement");
    assert.equal(implementModule.type, "loop");
    assert.equal(implementModule.agentRole, "developer");
    assert.equal(implementModule.maxPromptSize, 32768);
    assert.deepEqual(implementModule.requiredOutputFields, ["STATUS"]);
  });

  it("rules treat shared files as read-only context", () => {
    const rules = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/rules.md"), "utf-8");
    assert.ok(rules.includes("SHARED_FILES are read/import context only"));
    assert.ok(rules.includes("Do NOT invent props for components imported from SHARED_FILES"));
    assert.ok(rules.includes("typed `actions` prop"));
    assert.ok(rules.includes("textContent"));
    assert.ok(rules.includes("Keep reducers/state transition functions pure"));
    assert.ok(rules.includes("vite.config.*"));
    assert.ok(rules.includes("Do NOT edit `index.html`"));
    assert.equal(rules.includes("small edits OK"), false);
  });

  it("keeps app diagnostics out of generated full-screen Stitch surfaces", () => {
    const prompt = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/prompt.md"), "utf-8");
    const rules = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/rules.md"), "utf-8");

    assert.match(prompt, /Do not add visible diagnostic, session, status, QA, debug, or telemetry strips/);
    assert.match(prompt, /Do not wrap generated full-screen Stitch screens in another semantic landmark\/root/);
    assert.match(prompt, /every visible product datum/);
    assert.match(prompt, /static Stitch placeholder/);
    assert.match(prompt, /changes visible DOM inside the generated screen/);
    assert.match(prompt, /same current value/);
    assert.match(prompt, /390px mobile viewport/);
    assert.match(prompt, /window\.app`\/`globalThis\.app/);
    assert.match(prompt, /preserve the generated screen's required mount layout/);
    assert.match(prompt, /flex min-h-screen w-full/);
    assert.match(prompt, /do not trade shell-chrome removal for a broken non-flex root/);
    assert.match(prompt, /Browser games and full-viewport interactive surfaces must render one continuous viewport scene/);
    assert.match(prompt, /Do not fake a scene by repeating the same large `<img>` tile across a grid/);
    assert.match(prompt, /settings, pause, and game-over panels as overlays on that scene/);
    assert.match(rules, /Generated screen content must be state-driven/);
    assert.match(rules, /visible tables, rows, cards, metrics, forms/);
    assert.match(rules, /not complete until a real owned action changes visible DOM/);
    assert.match(rules, /must not be no-ops/);
    assert.match(rules, /same current value/);
    assert.match(rules, /Do not add visible diagnostic\/session\/status\/debug\/QA strips/);
    assert.match(rules, /Generated screens own their semantic landmarks/);
    assert.match(rules, /window\.app` or `globalThis\.app/);
    assert.match(rules, /horizontally overflows the generated screen on mobile/);
    assert.match(rules, /preserve the generated screen's required mount layout/);
    assert.match(rules, /not at the cost of a broken non-flex root/);
    assert.match(rules, /one continuous viewport scene/);
    assert.match(rules, /do not repeat the same large `<img>` as tiled scene content/);
  });

  it("documents orchestrator-owned implementation evidence rollout modes", () => {
    const prompt = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/prompt.md"), "utf-8");
    const rules = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/rules.md"), "utf-8");

    assert.match(prompt, /required when Setfarm runs with `SETFARM_IMPLEMENT_EVIDENCE_GATE=blocking`/);
    assert.match(prompt, /strongly expected when it runs with `advisory`/);
    assert.match(prompt, /IMPLEMENT_INTENT\.json` before broad coding/);
    assert.match(prompt, /IMPLEMENT_VERIFICATION_REQUEST\.json` after coding/);
    assert.match(prompt, /Do not write `IMPLEMENT_EVIDENCE\.json`; Setfarm owns that file/);
    assert.match(prompt, /Do not report `STATUS: done` for a runtime\/UI story without those request artifacts in blocking mode/);
    assert.match(prompt, /"schema": "setfarm\.implement-intent\.v1"/);
    assert.match(prompt, /"schema": "setfarm\.implement-verification-request\.v1"/);
    assert.match(prompt, /"status": "ready_for_orchestrator_verification"/);
    assert.match(prompt, /"minFlowCount": 1/);
    assert.doesNotMatch(prompt, /\{\{ACTION_ID\}\}/);
    assert.match(prompt, /\[data-action-id='<action-id>'\]/);
    assert.match(prompt, /Build, test, source-grep, and prose checks do not belong there/);
    assert.match(rules, /with `SETFARM_IMPLEMENT_EVIDENCE_GATE=blocking`, runtime\/UI stories must create `\.setfarm\/implement\/<story-id>\/IMPLEMENT_INTENT\.json` before broad coding/);
    assert.match(rules, /In `advisory` mode these artifacts are still expected and surfaced in Mission Control, but missing artifacts do not block completion/);
    assert.match(rules, /"schema": "setfarm\.implement-intent\.v1"/);
    assert.match(rules, /"status": "ready_for_orchestrator_verification"/);
    assert.match(rules, /runtimeEvidenceRequired\.minFlowCount: 0/);
    assert.match(rules, /never put build\/test\/source-grep\/prose checks there/);
  });

  it("blocks generated-screen runtime stories without evidence even when preview script is absent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-no-preview-runtime-"));
    const previous = process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE;
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "gameplay", componentName: "GameplayScreen", file: "src/screens/GameplayScreen.tsx" },
      ]));

      const gate = checkImplementEvidenceGate("US-001", "Game engine and runtime", tmp);

      assert.equal(gate.passed, false);
      assert.equal(gate.category, "IMPLEMENT_EVIDENCE_INCOMPLETE");
      assert.match(gate.reason || "", /Missing artifacts/);
      assert.match(gate.reason || "", /intent/);
      assert.match(gate.reason || "", /request/);
      assert.match(gate.reason || "", /evidence/);
    } finally {
      if (previous === undefined) delete process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE;
      else process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = previous;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("classifies occluded runtime interaction evidence as a clickable target layout failure", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-occluded-"));
    const previous = process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE;
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      const evidenceDir = path.join(tmp, ".setfarm", "implement", "US-001");
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ scripts: { preview: "vite preview" } }));
      fs.writeFileSync(path.join(evidenceDir, "IMPLEMENT_INTENT.json"), JSON.stringify({
        schema: "setfarm.implement-intent.v1",
        storyId: "US-001",
        storyType: "ui_interactive",
        acceptanceCriteria: [{ id: "AC-001", description: "Start control is clickable" }],
        runtimeEvidenceRequired: { minFlowCount: 1 },
      }));
      fs.writeFileSync(path.join(evidenceDir, "IMPLEMENT_VERIFICATION_REQUEST.json"), JSON.stringify({
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: [{ actionId: "ACT_START" }],
        uncoveredCriteria: [],
        knownGaps: [],
      }));
      fs.writeFileSync(path.join(evidenceDir, "IMPLEMENT_EVIDENCE.json"), JSON.stringify({
        schema: "setfarm.implement-evidence.v1",
        storyId: "US-001",
        runtime: { url: "http://127.0.0.1:6123", portAllocatedByMC: true },
        commands: [],
        flows: [{
          flowId: "ACT_START",
          passed: false,
          interactions: [{
            id: "start-game-1",
            status: "fail",
            detail: "locator.click: Timeout 30000ms exceeded. <header class=\"fixed top-0 left-0 w-full z-50\"> intercepts pointer events",
          }],
        }],
        visualEvidence: { status: "skipped" },
        verdict: "fail",
      }));

      const gate = checkImplementEvidenceGate("US-001", "Gameplay", tmp);

      assert.equal(gate.passed, false);
      assert.equal(gate.category, "UI_INTERACTION_TARGET_OCCLUDED");
      assert.match(gate.reason || "", /intercepts pointer events/);
      assert.match(gate.suggestion || "", /z-index|pointer-events/);
    } finally {
      if (previous === undefined) delete process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE;
      else process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = previous;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps retry worktree patch feedback compact instead of injecting raw diffs", () => {
    const sources = [
      "dist/installer/steps/06-implement/context.js",
      "dist/installer/step-ops.js",
    ];
    for (const sourcePath of sources) {
      const source = fs.readFileSync(path.join(process.cwd(), sourcePath), "utf-8");
      const blockStart = source.indexOf("RETRY_WORKTREE_PATCH:");
      assert.notEqual(blockStart, -1, `${sourcePath} retry patch feedback block missing`);
      const block = source.slice(blockStart, blockStart + 1200);
      assert.match(block, /compact diagnostic summary/, sourcePath);
      assert.match(block, /Touched files/, sourcePath);
      assert.match(block, /Patch size/, sourcePath);
      assert.doesNotMatch(block, /```diff/, sourcePath);
      assert.doesNotMatch(source, /maxChars\s*=\s*30000/, sourcePath);
    }
  });

  it("blocks visible app-shell diagnostics around generated full-screen Stitch screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-shell-chrome-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "operations",
          title: "Operations",
          componentName: "OperationsScreen",
          file: "src/screens/OperationsScreen.tsx",
        },
      ]));
      fs.writeFileSync(
        path.join(tmp, "src/screens/OperationsScreen.tsx"),
        "export function OperationsScreen() { return <main data-testid=\"operations-screen\">Operations</main>; }\n",
      );
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { OperationsScreen } from './screens/OperationsScreen';",
        "export default function App() {",
        "  return <div>",
        "    <div className=\"fixed top-0 left-0 right-0 z-50 w-full\" data-testid=\"session-status-strip\">Session Status OK</div>",
        "    <OperationsScreen />",
        "  </div>;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenShellChromeIssues(tmp);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /GENERATED_SCREEN_SHELL_CHROME_UNSAFE/);
      assert.match(issues[0], /src\/App\.tsx/);

      const gate = checkGeneratedScreenShellChromeGate("US-001", "App Shell", tmp);
      assert.equal(gate.passed, false);
      assert.equal(gate.category, "GENERATED_SCREEN_SHELL_CHROME_UNSAFE");
      assert.match(gate.reason || "", /app-level chrome/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks visible route panel storage statusbar around generated full-screen Stitch screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-shell-statusbar-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "operations",
          title: "Operations",
          componentName: "OperationsScreen",
          file: "src/screens/OperationsScreen.tsx",
        },
      ]));
      fs.writeFileSync(
        path.join(tmp, "src/screens/OperationsScreen.tsx"),
        "export function OperationsScreen() { return <main data-testid=\"operations-screen\">Operations</main>; }\n",
      );
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { OperationsScreen } from './screens/OperationsScreen';",
        "export default function App() {",
        "  const store = { activeRoute: '/', activePanel: 'operations', storageStatus: 'ready', counts: { total: 3 } };",
        "  return <section className=\"calibratrack-shell\">",
        "    <div className=\"calibratrack-statusbar\" aria-live=\"polite\">",
        "      <span>Route: {store.activeRoute}</span>",
        "      <span>Panel: {store.activePanel}</span>",
        "      <span>Records: {store.counts.total}</span>",
        "      <span>Storage: {store.storageStatus}</span>",
        "    </div>",
        "    <OperationsScreen />",
        "  </section>;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenShellChromeIssues(tmp);
      assert.equal(issues.length, 1);
      assert.match(issues.join("\n"), /GENERATED_SCREEN_SHELL_CHROME_UNSAFE/);

      const gate = checkGeneratedScreenShellChromeGate("US-001", "App Shell", tmp);
      assert.equal(gate.passed, false);
      assert.equal(gate.category, "GENERATED_SCREEN_SHELL_CHROME_UNSAFE");
      assert.match(gate.reason || "", /visible diagnostic/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks app shell status test hooks around generated full-screen Stitch screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-shell-testid-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "operations",
          title: "Operations",
          componentName: "OperationsScreen",
          file: "src/screens/OperationsScreen.tsx",
        },
      ]));
      fs.writeFileSync(
        path.join(tmp, "src/screens/OperationsScreen.tsx"),
        "export function OperationsScreen() { return <main data-testid=\"operations-screen\">Operations</main>; }\n",
      );
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { OperationsScreen } from './screens/OperationsScreen';",
        "export default function App() {",
        "  return <div data-setfarm-root=\"clinicflow-lite\" className=\"min-h-screen bg-background\">",
        "    <section aria-live=\"polite\" data-testid=\"clinicflow-shell-status\" className=\"border-b w-full\">",
        "      <span data-testid=\"clinicflow-storage-message\">Clinic workspace is ready.</span>",
        "      <span data-testid=\"clinicflow-active-panel\">Panel: patients</span>",
        "    </section>",
        "    <OperationsScreen />",
        "  </div>;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenShellChromeIssues(tmp);
      assert.equal(issues.length, 1);
      assert.match(issues.join("\n"), /GENERATED_SCREEN_SHELL_CHROME_UNSAFE/);

      const gate = checkGeneratedScreenShellChromeGate("US-001", "App Shell", tmp);
      assert.equal(gate.passed, false);
      assert.equal(gate.category, "GENERATED_SCREEN_SHELL_CHROME_UNSAFE");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks duplicate app-shell main landmarks around generated full-screen Stitch screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-shell-landmark-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "operations",
          title: "Operations",
          componentName: "OperationsScreen",
          file: "src/screens/OperationsScreen.tsx",
        },
      ]));
      fs.writeFileSync(
        path.join(tmp, "src/screens/OperationsScreen.tsx"),
        "export function OperationsScreen() { return <main data-testid=\"operations-screen\">Operations</main>; }\n",
      );
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { OperationsScreen } from './screens/OperationsScreen';",
        "export default function App() {",
        "  return <main data-setfarm-root=\"app\">",
        "    <OperationsScreen />",
        "  </main>;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenShellChromeIssues(tmp);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /GENERATED_SCREEN_SHELL_LANDMARK_UNSAFE/);
      assert.match(issues[0], /src\/App\.tsx/);
      assert.match(issues[0], /neutral <div data-setfarm-root>/);

      const gate = checkGeneratedScreenShellChromeGate("US-001", "App Shell", tmp);
      assert.equal(gate.passed, false);
      assert.equal(gate.category, "GENERATED_SCREEN_SHELL_CHROME_UNSAFE");
      assert.match(gate.reason || "", /main landmark/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("allows sibling app-shell main landmarks that do not wrap generated screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-shell-landmark-sibling-ok-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "operations",
          title: "Operations",
          componentName: "OperationsScreen",
          file: "src/screens/OperationsScreen.tsx",
        },
      ]));
      fs.writeFileSync(
        path.join(tmp, "src/screens/OperationsScreen.tsx"),
        "export function OperationsScreen() { return <main data-testid=\"operations-screen\">Operations</main>; }\n",
      );
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { OperationsScreen } from './screens/OperationsScreen';",
        "export default function App() {",
        "  return <div data-setfarm-root=\"app\">",
        "    <div role=\"main\" aria-label=\"Operations runtime\" className=\"sr-only\">Ready</div>",
        "    <OperationsScreen />",
        "  </div>;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findGeneratedScreenShellChromeIssues(tmp), []);
      assert.equal(checkGeneratedScreenShellChromeGate("US-001", "App Shell", tmp).passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks non-flex mounts for generated sibling sidebar/content screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-flex-mount-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "board",
          title: "Board",
          componentName: "BoardScreen",
          file: "src/screens/BoardScreen.tsx",
        },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/BoardScreen.tsx"), [
        "export function BoardScreen() {",
        "  return (<>",
        "    <nav className=\"h-screen w-[240px] shrink-0 hidden md:flex\">Nav</nav>",
        "    <div className=\"flex-1 flex flex-col h-screen\"><main>Board</main></div>",
        "  </>);",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { BoardScreen } from './screens/BoardScreen';",
        "export default function App() {",
        "  return <div data-setfarm-root=\"board\" className=\"min-h-screen bg-white\">",
        "    <BoardScreen />",
        "  </div>;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenShellChromeIssues(tmp);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /GENERATED_SCREEN_LAYOUT_MOUNT_UNSAFE/);
      assert.match(issues[0], /non-flex data-setfarm-root/);

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { BoardScreen } from './screens/BoardScreen';",
        "export default function App() {",
        "  return <div data-setfarm-root=\"board\" className=\"flex min-h-screen bg-white\">",
        "    <BoardScreen />",
        "  </div>;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findGeneratedScreenShellChromeIssues(tmp), []);

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { BoardScreen } from './screens/BoardScreen';",
        "export default function App() {",
        "  return <div data-setfarm-root=\"board\" className=\"min-h-screen bg-white\" style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>",
        "    <BoardScreen />",
        "  </div>;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findGeneratedScreenShellChromeIssues(tmp), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks collapsed roots for generated absolute viewport screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-viewport-mount-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "gameplay",
          title: "Gameplay",
          componentName: "GameplayScreen",
          file: "src/screens/GameplayScreen.tsx",
        },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/GameplayScreen.tsx"), [
        "export function GameplayScreen() {",
        "  return (<>",
        "    <div className=\"absolute inset-0 bg-background\" />",
        "    <main className=\"absolute inset-0 flex items-center justify-center\">Game</main>",
        "  </>);",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "export default function App() {",
        "  return <div data-setfarm-root data-testid=\"setfarm-app-root\" className=\"min-h-screen\">",
        "    <GameplayScreen />",
        "  </div>;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenShellChromeIssues(tmp);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /GENERATED_SCREEN_VIEWPORT_MOUNT_UNSAFE/);
      assert.match(issues[0], /relative min-h-screen/);
      assert.match(issues[0], /w-full overflow-hidden/);

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "export default function App() {",
        "  return <div data-setfarm-root data-testid=\"setfarm-app-root\" className=\"relative min-h-screen w-full overflow-hidden\">",
        "    <GameplayScreen />",
        "  </div>;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findGeneratedScreenShellChromeIssues(tmp), []);
      assert.equal(checkGeneratedScreenShellChromeGate("US-002", "Gameplay", tmp).passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("allows app-shell main landmarks when generated screens do not own main landmarks", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-shell-landmark-ok-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "operations",
          title: "Operations",
          componentName: "OperationsScreen",
          file: "src/screens/OperationsScreen.tsx",
        },
      ]));
      fs.writeFileSync(
        path.join(tmp, "src/screens/OperationsScreen.tsx"),
        "export function OperationsScreen() { return <section data-testid=\"operations-screen\">Operations</section>; }\n",
      );
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { OperationsScreen } from './screens/OperationsScreen';",
        "export default function App() {",
        "  return <main data-setfarm-root=\"app\">",
        "    <OperationsScreen />",
        "  </main>;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findGeneratedScreenShellChromeIssues(tmp), []);
      assert.equal(checkGeneratedScreenShellChromeGate("US-001", "App Shell", tmp).passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("allows invisible window.app smoke state for generated full-screen Stitch screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-shell-chrome-ok-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "operations",
          title: "Operations",
          componentName: "OperationsScreen",
          file: "src/screens/OperationsScreen.tsx",
        },
      ]));
      fs.writeFileSync(
        path.join(tmp, "src/screens/OperationsScreen.tsx"),
        "export function OperationsScreen() { return <main data-testid=\"operations-screen\">Operations</main>; }\n",
      );
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { OperationsScreen } from './screens/OperationsScreen';",
        "export default function App() {",
        "  (globalThis as any).app = { storageStatus: 'ready', activeSurface: 'operations' };",
        "  return <OperationsScreen />;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findGeneratedScreenShellChromeIssues(tmp), []);
      assert.equal(checkGeneratedScreenShellChromeGate("US-001", "App Shell", tmp).passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks missing required props when app renders generated screen without adapter", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-required-props-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "operations", title: "Operations", componentName: "ItemOperationsScreen", file: "src/screens/ItemOperationsScreen.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/ItemOperationsScreen.tsx"), [
        "export type ItemOperationsScreenProps = {",
        "  items: Array<{ id: string; label: string }>;",
        "  counts: { total: number };",
        "  selectedItem: string | null;",
        "  onCreate?: () => void;",
        "  className?: string;",
        "};",
        "export function ItemOperationsScreen(props: ItemOperationsScreenProps) {",
        "  return <main>{props.items.length}</main>;",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { ItemOperationsScreen } from './screens/ItemOperationsScreen';",
        "export default function App() {",
        "  return <ItemOperationsScreen />;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenRequiredPropIssues(tmp);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /items/);
      assert.match(issues[0], /counts/);
      assert.match(issues[0], /selectedItem/);
      assert.doesNotMatch(issues[0], /onCreate/);
      assert.doesNotMatch(issues[0], /className/);

      const gate = checkGeneratedScreenRequiredPropsGate("US-001", "App Shell", tmp);
      assert.equal(gate.passed, false);
      assert.equal(gate.category, "GENERATED_SCREEN_REQUIRED_PROPS_UNWIRED");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("allows generated screens when required props are wired", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-required-props-ok-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "operations", title: "Operations", componentName: "ItemOperationsScreen", file: "src/screens/ItemOperationsScreen.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/ItemOperationsScreen.tsx"), [
        "export type ItemOperationsScreenProps = {",
        "  items: Array<{ id: string; label: string }>;",
        "  counts: { total: number };",
        "  selectedItem: string | null;",
        "};",
        "export function ItemOperationsScreen(props: ItemOperationsScreenProps) {",
        "  return <main>{props.items.length}</main>;",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { ItemOperationsScreen } from './screens/ItemOperationsScreen';",
        "export default function App() {",
        "  return <ItemOperationsScreen items={[]} counts={{ total: 0 }} selectedItem={null} />;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findGeneratedScreenRequiredPropIssues(tmp), []);
      assert.equal(checkGeneratedScreenRequiredPropsGate("US-001", "App Shell", tmp).passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks generated runtime semantic shortcuts that make fake UI progress look complete", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-runtime-semantics-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/features/return-desk"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/features/surf-triage"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "triage", title: "Triage", componentName: "TriageScreen", file: "src/screens/TriageScreen.tsx" },
        { screenId: "reports", title: "Reports", componentName: "ReportsScreen", file: "src/screens/ReportsScreen.tsx" },
        { screenId: "settings", title: "Settings", componentName: "SettingsScreen", file: "src/screens/SettingsScreen.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/TriageScreen.tsx"), [
        "import { BadgeHelp, Circle } from 'lucide-react';",
        "export function TriageScreen() {",
        "  return <nav><a href=\"#\"><Circle />Dashboard</a><a href=\"#\"><BadgeHelp />Reports</a><button><BadgeHelp />Sort</button></nav>;",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/screens/ReportsScreen.tsx"), "export function ReportsScreen() { return <main>Reports</main>; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/SettingsScreen.tsx"), "export function SettingsScreen() { return <main>Settings</main>; }\n");
      fs.writeFileSync(path.join(tmp, "src/features/return-desk/store.ts"), [
        "export function useStore(state: any) {",
        "  return { snapshot: { activeScreen: 'TriageScreen', activeRoute: state.route, activePanel: state.panel } };",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/features/surf-triage/act_update_record_status.ts"), [
        "export function updateRecordStatus(store: any, id: string, status: string) {",
        "  store.selectRecord(id);",
        "  store.setActivePanel(status);",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { TriageScreen } from './screens/TriageScreen';",
        "import { ReportsScreen } from './screens/ReportsScreen';",
        "import { SettingsScreen } from './screens/SettingsScreen';",
        "export default function App({ activeRoute }: { activeRoute: string }) {",
        "  if (activeRoute !== 'triage') return <ReportsScreen />;",
        "  return <TriageScreen />;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedRuntimeSemanticIssues(tmp);
      assert.equal(issues.some((issue) => issue.includes("GENERATED_RUNTIME_HARDCODED_SCREEN")), true);
      assert.equal(issues.some((issue) => issue.includes("GENERATED_ICON_FALLBACK")), true);
      assert.equal(issues.some((issue) => issue.includes("ACTION_SEMANTIC_NOOP")), true);
      assert.equal(issues.some((issue) => issue.includes("GENERATED_ROUTE_COLLAPSE")), true);

      const gate = checkGeneratedRuntimeSemanticGate("US-001", "App Shell", tmp);
      assert.equal(gate.passed, false);
      assert.equal(gate.category, "GENERATED_RUNTIME_SEMANTIC_INCOMPLETE");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks browser-game runtime stories without an automatic game loop", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-browser-game-loop-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "loopless-game", keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { componentName: "GameplayScreen", file: "src/screens/GameplayScreen.tsx", title: "Gameplay" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/GameplayScreen.tsx"), [
        "export function GameplayScreen({ runtime, actions }: any) {",
        "  return <main><button onClick={actions.advance}>Advance</button><span>{runtime.score}</span></main>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "const actions = { advance() { return undefined; } };",
        "export default function App() {",
        "  return <GameplayScreen runtime={{ score: 0 }} actions={actions} />;",
        "}",
      ].join("\n"));

      const issues = findGeneratedRuntimeSemanticIssues(tmp);
      assert.equal(issues.some((issue) => issue.includes("BROWSER_GAME_RUNTIME_LOOP_MISSING")), true);
      const gate = checkGeneratedRuntimeSemanticGate("US-001", "Game Runtime", tmp);
      assert.equal(gate.passed, false);
      assert.equal(gate.category, "GENERATED_RUNTIME_SEMANTIC_INCOMPLETE");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts browser-game runtime stories with a scheduled game loop", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-browser-game-loop-pass-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "looped-game", keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { componentName: "GameplayScreen", file: "src/screens/GameplayScreen.tsx", title: "Gameplay" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/GameplayScreen.tsx"), [
        "export function GameplayScreen({ runtime, actions }: any) {",
        "  return <main><button onClick={actions.advance}>Advance</button><span>{runtime.score}</span></main>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { useEffect } from 'react';",
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "const actions = { advance() { return undefined; } };",
        "export default function App() {",
        "  useEffect(() => { const id = setInterval(() => actions.advance(), 100); return () => clearInterval(id); }, []);",
        "  return <GameplayScreen runtime={{ score: 0 }} actions={actions} />;",
        "}",
      ].join("\n"));

      const issues = findGeneratedRuntimeSemanticIssues(tmp);
      assert.equal(issues.some((issue) => issue.includes("BROWSER_GAME_RUNTIME_LOOP_MISSING")), false);
      const gate = checkGeneratedRuntimeSemanticGate("US-001", "Game Runtime", tmp);
      assert.equal(gate.passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts browser-game scheduled reducer dispatch and state updater loops", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-browser-game-dispatch-loop-pass-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "reducer-game", keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { componentName: "GameplayScreen", file: "src/screens/GameplayScreen.tsx", title: "Gameplay" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/GameplayScreen.tsx"), [
        "export function GameplayScreen({ runtime, actions }: any) {",
        "  return <main><button onClick={actions.pause}>Pause</button><span>{runtime.score}</span></main>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { useEffect, useReducer, useState } from 'react';",
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "function advanceGame(state: any) { return { ...state, score: state.score + 1 }; }",
        "function reducer(state: any, action: any) { return action.type === 'tick' ? advanceGame(state) : state; }",
        "export default function App() {",
        "  const [runtime, dispatch] = useReducer(reducer, { score: 0 });",
        "  const [, setPreview] = useState(runtime);",
        "  useEffect(() => { const id = setInterval(() => dispatch({ type: 'tick' }), 100); return () => clearInterval(id); }, []);",
        "  useEffect(() => { const id = setInterval(() => setPreview((prev) => advanceGame(prev)), 100); return () => clearInterval(id); }, []);",
        "  return <GameplayScreen runtime={runtime} actions={{ pause() {} }} />;",
        "}",
      ].join("\n"));

      const issues = findGeneratedRuntimeSemanticIssues(tmp);
      assert.equal(issues.some((issue) => issue.includes("BROWSER_GAME_RUNTIME_LOOP_MISSING")), false);
      const gate = checkGeneratedRuntimeSemanticGate("US-001", "Game Runtime", tmp);
      assert.equal(gate.passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts browser-game requestAnimationFrame named callback dispatch loops", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-browser-game-raf-named-loop-pass-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "raf-game", keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { componentName: "GameplayScreen", file: "src/screens/GameplayScreen.tsx", title: "Gameplay" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/GameplayScreen.tsx"), [
        "export function GameplayScreen({ runtime, actions }: any) {",
        "  return <main><button onClick={actions.pause}>Pause</button><span>{runtime.score}</span></main>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { useEffect, useReducer } from 'react';",
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "function reducer(state: any, action: any) { return action.type === 'TICK' ? { ...state, score: state.score + 1 } : state; }",
        "export default function App() {",
        "  const [runtime, dispatch] = useReducer(reducer, { score: 0 });",
        "  useEffect(() => {",
        "    let handle = 0;",
        "    function loop() {",
        "      dispatch({ type: 'TICK' });",
        "      handle = requestAnimationFrame(loop);",
        "    }",
        "    handle = requestAnimationFrame(loop);",
        "    return () => cancelAnimationFrame(handle);",
        "  }, []);",
        "  return <GameplayScreen runtime={runtime} actions={{ pause() {} }} />;",
        "}",
      ].join("\n"));

      const issues = findGeneratedRuntimeSemanticIssues(tmp);
      assert.equal(issues.some((issue) => issue.includes("BROWSER_GAME_RUNTIME_LOOP_MISSING")), false);
      const gate = checkGeneratedRuntimeSemanticGate("US-001", "Game Runtime", tmp);
      assert.equal(gate.passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps git ownership in the platform instead of the implement agent", () => {
    const prompt = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/prompt.md"), "utf-8");
    const contextSource = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/context.js"), "utf-8");
    const rules = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/rules.md"), "utf-8");
    const workflow = fs.readFileSync(path.join(process.cwd(), "workflows/feature-dev/workflow.yml"), "utf-8");
    const implementInput = workflow.split("\n  - id: implement\n")[1]?.split("\n  - id: verify\n")[0] || "";
    assert.match(prompt, /Do NOT run `git add`, `git commit`, `git push`, `gh pr create`, or any branch command/);
    assert.match(prompt, /Setfarm performs the final scoped story commit after build\/scope\/supervisor gates pass/);
    assert.match(prompt, /Story Implementation Contract/);
    assert.match(prompt, /Implement Context/);
    assert.match(prompt, /owned screens, actions, state, persistence, navigation, and\s+test obligations/);
    assert.match(contextSource, /story_implementation_contract/);
    assert.match(contextSource, /implementation_contract, scope_targets, shared_edit_requests/);
    assert.match(contextSource, /assembleImplementContext/);
    assert.match(contextSource, /Generated screen content must render from story-owned props\/store\/adapters/);
    assert.match(contextSource, /visible DOM inside the generated screen/);
    assert.match(rules, /Do NOT run `git add`, `git commit`, `git push`/);
    assert.match(implementInput, /Setfarm performs the final\s+scoped story commit/);
    assert.doesNotMatch(prompt, /xargs -a \.story-scope-files git add --/);
    assert.doesNotMatch(prompt, /git commit -m "feat: <story-id> - <description>"/);
    assert.doesNotMatch(rules, /Commit once at the end/);
    assert.doesNotMatch(implementInput, /git commit -m "feat:/);
    assert.doesNotMatch(implementInput, /git push -u origin/);
  });

  it("platform story commit stages only declared scope and implicit test files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      fs.writeFileSync(path.join(tmp, "src/Other.tsx"), "export const other = 'base';\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx", "src/Other.tsx"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'changed';\n");
      fs.writeFileSync(path.join(tmp, "src/App.test.tsx"), "it('works', () => {});\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-001", "state shell");

      assert.equal(result.error, "");
      assert.equal(result.committed, true);
      assert.deepEqual(result.stagedFiles.sort(), ["src/App.test.tsx", "src/App.tsx"].sort());
      assert.match(git(tmp, ["log", "-1", "--format=%s"]), /feat: US-001 - state shell/);
      const status = git(tmp, ["status", "--porcelain"]);
      assert.doesNotMatch(status, /src\/App/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("platform story commit bypasses the implement agent git wrapper", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-wrapper-"));
    const originalPath = process.env.PATH;
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'changed';\n");

      const wrapperDir = path.join(tmp, ".setfarm-bin");
      fs.mkdirSync(wrapperDir, { recursive: true });
      fs.writeFileSync(path.join(wrapperDir, "git"), "#!/usr/bin/env bash\necho WRAPPER_HIT >&2\nexit 2\n", { mode: 0o755 });
      process.env.PATH = `${wrapperDir}${path.delimiter}${originalPath || ""}`;

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-001", "wrapper bypass");

      assert.equal(result.error, "");
      assert.equal(result.committed, true);
      process.env.PATH = originalPath;
      assert.equal(git(tmp, ["log", "-1", "--format=%s"]), "feat: US-001 - wrapper bypass");
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("platform story commit can use declared DB scope and ignores pre-staged internal files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-db-scope-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      fs.writeFileSync(path.join(tmp, "SUPERVISOR_MEMORY.md"), "base memory\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx", "SUPERVISOR_MEMORY.md"]);
      git(tmp, ["commit", "-m", "base"]);

      fs.writeFileSync(path.join(tmp, "SUPERVISOR_MEMORY.md"), "dirty internal memory\n");
      git(tmp, ["add", "SUPERVISOR_MEMORY.md"]);
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'supervisor fix';\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-001", "supervisor fix", ["src/App.tsx"], "fix");

      assert.equal(result.error, "");
      assert.equal(result.committed, true);
      assert.deepEqual(result.stagedFiles, ["src/App.tsx"]);
      assert.equal(git(tmp, ["log", "-1", "--format=%s"]), "fix: US-001 - supervisor fix");
      const committedFiles = git(tmp, ["show", "--name-only", "--format=", "HEAD"]).trim().split(/\r?\n/).filter(Boolean);
      assert.deepEqual(committedFiles, ["src/App.tsx"]);
      const status = git(tmp, ["status", "--porcelain"]);
      assert.match(status, /^M SUPERVISOR_MEMORY\.md$/m);
      assert.doesNotMatch(status, /^M  SUPERVISOR_MEMORY\.md$/m);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("platform story commit ignores supervisor runtime artifacts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-supervisor-artifacts-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");

      fs.mkdirSync(path.join(tmp, ".setfarm/supervisor/run-1"), { recursive: true });
      fs.writeFileSync(path.join(tmp, ".setfarm/supervisor/run-1/SUPERVISOR_RUN.json"), "{}\n");
      fs.writeFileSync(path.join(tmp, ".setfarm/supervisor/run-1/SUPERVISOR_EVENTS.jsonl"), "{}\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-001", "supervisor pass", ["src/App.tsx"], "fix");

      assert.equal(result.error, "");
      assert.equal(result.committed, false);
      assert.deepEqual(result.stagedFiles, []);
      assert.equal(git(tmp, ["log", "-1", "--format=%s"]), "base");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("platform story commit ignores transient runtime smoke artifacts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-runtime-artifacts-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'changed';\n");
      fs.writeFileSync(path.join(tmp, "smoke-home.png"), "fake image\n");
      fs.mkdirSync(path.join(tmp, "test-results/story"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "test-results/story/video.webm"), "video\n");
      fs.mkdirSync(path.join(tmp, "playwright-report"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "playwright-report/index.html"), "<html></html>\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-001", "runtime artifacts", ["src/App.tsx"], "fix");

      assert.equal(result.error, "");
      assert.equal(result.committed, true);
      assert.deepEqual(result.stagedFiles, ["src/App.tsx"]);
      assert.equal(git(tmp, ["show", "--name-only", "--format=", "HEAD"]).trim(), "src/App.tsx");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rehydrates a deleted story branch worktree for supervisor and reviewer audits", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-review-worktree-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'main';\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx"]);
      git(tmp, ["commit", "-m", "base"]);
      git(tmp, ["checkout", "-b", "33d23f10-us-001"]);
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'story';\n");
      git(tmp, ["add", "src/App.tsx"]);
      git(tmp, ["commit", "-m", "feat: US-001 story"]);
      git(tmp, ["checkout", "main"]);

      const reviewWorkdir = ensureStoryBranchWorktree(tmp, "33d23f10-us-001");

      assert.ok(reviewWorkdir.endsWith(path.join(".worktrees", "33d23f10-us-001")));
      assert.equal(git(reviewWorkdir, ["branch", "--show-current"]), "33d23f10-us-001");
      assert.equal(fs.readFileSync(path.join(reviewWorkdir, "src/App.tsx"), "utf-8"), "export const app = 'story';\n");
      assert.equal(git(tmp, ["branch", "--show-current"]), "main");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("prefers the current matching supervisor worktree over a stale canonical path", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-story-worktree-select-"));
    const repo = path.join(tmp, "repo");
    const supervisorWorktree = path.join(tmp, "supervisor", "story-worktrees", "33d23f10-us-003");
    const staleCanonical = path.join(tmp, "developer", "story-worktrees", "33d23f10-us-003");

    try {
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src/App.tsx"), "export const app = 'main';\n");
      git(repo, ["init", "-b", "main"]);
      git(repo, ["add", "src/App.tsx"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["branch", "33d23f10-us-003", "main"]);
      fs.mkdirSync(path.dirname(supervisorWorktree), { recursive: true });
      git(repo, ["worktree", "add", supervisorWorktree, "33d23f10-us-003"]);
      fs.mkdirSync(staleCanonical, { recursive: true });

      const selected = selectMatchingStoryWorktree("33d23f10-us-003", supervisorWorktree, staleCanonical);

      assert.equal(selected, supervisorWorktree);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("uses one implicit story scope rule for runtime guard and platform commit", () => {
    assert.equal(isImplicitStoryScopeFile("src/test/utils.tsx"), true);
    assert.equal(isImplicitStoryScopeFile("./src/test/setup.mts"), true);
    assert.equal(isImplicitStoryScopeFile("src/types/domain.test.ts"), true);
    assert.equal(isImplicitStoryScopeFile("src/types/domain.ts"), false);
    assert.ok(IMPLICIT_STORY_SCOPE_FILES.includes("src/test/utils.tsx"));

    const guards = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/guards.js"), "utf-8");
    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    const context = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/context.js"), "utf-8");
    assert.match(guards, /isImplicitStoryScopeFile/);
    assert.match(stepOps, /isImplicitStoryScopeFile/);
    assert.match(stepOps, /IMPLICIT_STORY_SCOPE_FILES/);
    assert.match(context, /IMPLICIT_STORY_SCOPE_FILES/);
    assert.doesNotMatch(stepOps, /PLATFORM_STORY_COMMIT_ALLOWED_PATTERNS/);
  });

  it("platform story commit refuses out-of-scope files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-block-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      fs.writeFileSync(path.join(tmp, "src/Other.tsx"), "export const other = 'base';\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx", "src/Other.tsx"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
      fs.writeFileSync(path.join(tmp, "src/Other.tsx"), "export const other = 'blocked';\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-002", "blocked scope");

      assert.equal(result.committed, false);
      assert.match(result.error, /PLATFORM_STORY_COMMIT_SCOPE_BLOCKED/);
      assert.match(result.error, /src\/Other\.tsx/);
      assert.equal(git(tmp, ["log", "-1", "--format=%s"]), "base");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("cleans out-of-scope dirty files after platform commit scope blocks", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-clean-block-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      fs.writeFileSync(path.join(tmp, "src/index.css"), "body { color: black; }\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx", "src/index.css"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'changed';\n");
      fs.writeFileSync(path.join(tmp, "src/index.css"), "body { color: red; }\n");
      fs.writeFileSync(path.join(tmp, "src/Stray.tsx"), "export const stray = true;\n");

      const blocked = commitStoryWorktreeScopeIfNeeded(tmp, "US-002", "blocked scope");
      assert.match(blocked.error, /PLATFORM_STORY_COMMIT_SCOPE_BLOCKED/);

      const cleaned = cleanupBlockedStoryCommitScope(tmp, "US-002");

      assert.deepEqual(cleaned.sort(), ["src/Stray.tsx", "src/index.css"].sort());
      assert.equal(fs.existsSync(path.join(tmp, "src/Stray.tsx")), false);
      assert.equal(fs.readFileSync(path.join(tmp, "src/index.css"), "utf-8"), "body { color: black; }\n");
      assert.equal(fs.readFileSync(path.join(tmp, "src/App.tsx"), "utf-8"), "export const app = 'changed';\n");
      const status = git(tmp, ["status", "--porcelain"]);
      assert.match(status, /M src\/App\.tsx/);
      assert.doesNotMatch(status, /src\/index\.css|src\/Stray\.tsx/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("platform story commit expands untracked scoped directories before checking scope", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-uall-"));
    try {
      fs.writeFileSync(path.join(tmp, "README.md"), "base\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "README.md"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), [
        "src/contexts/AppContext.tsx",
        "src/hooks/useAppState.ts",
        "src/types/domain.ts",
        "src/utils/storage.ts",
      ].join("\n") + "\n");
      fs.mkdirSync(path.join(tmp, "src/contexts"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/hooks"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/types"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/utils"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/contexts/AppContext.tsx"), "export const AppContext = {};\n");
      fs.writeFileSync(path.join(tmp, "src/hooks/useAppState.ts"), "export const useAppState = () => null;\n");
      fs.writeFileSync(path.join(tmp, "src/types/domain.ts"), "export type GameState = {};\n");
      fs.writeFileSync(path.join(tmp, "src/utils/storage.ts"), "export const storage = {};\n");
      fs.writeFileSync(path.join(tmp, "src/utils/storage.test.ts"), "import './storage';\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-001", "scoped directories");

      assert.equal(result.error, "");
      assert.equal(result.committed, true);
      assert.deepEqual(result.stagedFiles.sort(), [
        "src/contexts/AppContext.tsx",
        "src/hooks/useAppState.ts",
        "src/types/domain.ts",
        "src/utils/storage.test.ts",
        "src/utils/storage.ts",
      ].sort());
      assert.equal(git(tmp, ["log", "-1", "--format=%s"]), "feat: US-001 - scoped directories");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("scope enforcement counts untracked declared source files as real work", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-untracked-work-"));
    const runId = "scope-untracked-run";
    const storyDbId = "scope-untracked-story-" + Date.now();
    try {
      fs.writeFileSync(path.join(tmp, "README.md"), "base\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "README.md"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.mkdirSync(path.join(tmp, "src/features/surf-game-settings"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, "src/features/surf-game-settings/act_save_preferences.ts"),
        "export function actSavePreferences() { return true; }\n",
      );

      await pgRun(
        `INSERT INTO runs (id, workflow_id, task, status, created_at, updated_at)
         VALUES ($1, 'feature-dev', 'untracked scope work test', 'running', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [runId],
      );
      await pgRun(
        `INSERT INTO stories (id, run_id, story_index, story_id, title, status, scope_files, created_at, updated_at)
         VALUES ($1, $2, 0, 'US-001', 'Untracked Scope Story', 'running', $3, NOW(), NOW())`,
        [storyDbId, runId, JSON.stringify(["src/features/surf-game-settings/act_save_preferences.ts"])],
      );

      const result = await checkScopeEnforcement("US-001", storyDbId, "Untracked Scope Story", tmp, "main", 0, 3);

      assert.equal(result.passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
      await pgRun("DELETE FROM runs WHERE id = $1", [runId]);
    }
  });

  it("scope enforcement blocks untracked out-of-scope tool writes", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-untracked-bleed-"));
    const runId = "scope-untracked-bleed-run";
    const storyDbId = "scope-untracked-bleed-story-" + Date.now();
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/GameBoard.tsx"), "export function GameBoard() { return null; }\n");
      fs.writeFileSync(path.join(tmp, "README.md"), "base\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "base"]);

      fs.writeFileSync(path.join(tmp, "src/screens/GameBoard.tsx"), "export function GameBoard() { return <main>Done</main>; }\n");
      fs.writeFileSync(path.join(tmp, "src/index.css"), ".out-of-scope { color: red; }\n");

      await pgRun(
        `INSERT INTO runs (id, workflow_id, task, status, created_at, updated_at)
         VALUES ($1, 'feature-dev', 'untracked scope bleed test', 'running', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [runId],
      );
      await pgRun(
        `INSERT INTO stories (id, run_id, story_index, story_id, title, status, scope_files, created_at, updated_at)
         VALUES ($1, $2, 0, 'US-001', 'Untracked Scope Bleed Story', 'running', $3, NOW(), NOW())`,
        [storyDbId, runId, JSON.stringify(["src/screens/GameBoard.tsx"])],
      );

      const result = await checkScopeEnforcement("US-001", storyDbId, "Untracked Scope Bleed Story", tmp, "main", 0, 3);

      assert.equal(result.passed, false);
      assert.equal(result.category, "SCOPE_BLEED");
      assert.match(result.reason || "", /src\/index\.css/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
      await pgRun("DELETE FROM runs WHERE id = $1", [runId]);
    }
  });

  it("scope enforcement blocks reapplying deletions from a rejected retry patch", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-reapply-"));
    const runId = "retry-reapply-run";
    const storyDbId = "retry-reapply-story-" + Date.now();
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      const appPath = path.join(tmp, "src/App.tsx");
      fs.writeFileSync(appPath, [
        "import { actSavePreferences } from './features/surf-game-settings/act_save_preferences';",
        "import { actReturnToGameplay } from './features/surf-game-settings/act_return_to_gameplay';",
        "export function App() {",
        "  actSavePreferences();",
        "  actReturnToGameplay();",
        "  return null;",
        "}",
        "",
      ].join("\n"));
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "base"]);

      const retryPatchDir = path.join(tmp, ".setfarm", "retry-patches");
      fs.mkdirSync(retryPatchDir, { recursive: true });
      fs.writeFileSync(path.join(retryPatchDir, "257439ea-qa-fix-001-2026-06-05T08-04-07-492Z.patch"), [
        "diff --git a/src/App.tsx b/src/App.tsx",
        "--- a/src/App.tsx",
        "+++ b/src/App.tsx",
        "-import { actSavePreferences } from './features/surf-game-settings/act_save_preferences';",
        "-import { actReturnToGameplay } from './features/surf-game-settings/act_return_to_gameplay';",
        "",
      ].join("\n"));
      fs.writeFileSync(appPath, [
        "export function App() {",
        "  return null;",
        "}",
        "",
      ].join("\n"));

      await pgRun(
        `INSERT INTO runs (id, workflow_id, task, status, created_at, updated_at)
         VALUES ($1, 'feature-dev', 'retry patch reapply test', 'running', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [runId],
      );
      await pgRun(
        `INSERT INTO stories (id, run_id, story_index, story_id, title, status, scope_files, created_at, updated_at)
         VALUES ($1, $2, 0, 'QA-FIX-001', 'Retry Patch Story', 'running', $3, NOW(), NOW())`,
        [storyDbId, runId, JSON.stringify(["src/App.tsx"])],
      );

      const result = await checkScopeEnforcement("QA-FIX-001", storyDbId, "Retry Patch Story", tmp, "main", 1, 3);

      assert.equal(result.passed, false);
      assert.equal(result.category, "RETRY_PATCH_REAPPLIED");
      assert.match(result.reason || "", /actSavePreferences/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
      await pgRun("DELETE FROM runs WHERE id = $1", [runId]);
    }
  });

  it("scope enforcement keeps zero-work as a hard gate on the final retry", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-zero-final-"));
    const runId = "scope-zero-final-run";
    const storyDbId = "scope-zero-final-story-" + Date.now();
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/GameSettings.tsx"), "export function GameSettings() { return null; }\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "base"]);

      await pgRun(
        `INSERT INTO runs (id, workflow_id, task, status, created_at, updated_at)
         VALUES ($1, 'feature-dev', 'zero work final retry test', 'running', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [runId],
      );
      await pgRun(
        `INSERT INTO stories (id, run_id, story_index, story_id, title, status, scope_files, retry_count, max_retries, created_at, updated_at)
         VALUES ($1, $2, 0, 'US-003', 'Settings Story', 'running', $3, 3, 3, NOW(), NOW())`,
        [storyDbId, runId, JSON.stringify(["src/screens/GameSettings.tsx"])],
      );

      const result = await checkScopeEnforcement("US-003", storyDbId, "Settings Story", tmp, "main", 3, 3);

      assert.equal(result.passed, false);
      assert.equal(result.category, "NO_WORK_DETECTED");
      assert.match(result.reason || "", /NO WORK DETECTED/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
      await pgRun("DELETE FROM runs WHERE id = $1", [runId]);
    }
  });

  it("does not tell implement agents to read raw Stitch design corpus", () => {
    const prompt = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/prompt.md"), "utf-8");
    const contextSource = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/context.js"), "utf-8");

    assert.match(prompt, /Do not read raw `stitch\/\*\.html`/);
    assert.match(contextSource, /use UI_CONTRACT, SCREEN_INDEX, and story-owned generated screens instead of reading raw stitch HTML/);
    assert.doesNotMatch(contextSource, /read stitch files for full design/);
    assert.doesNotMatch(contextSource, /read stitch\/DESIGN_DOM\.json for full DOM/);
    assert.doesNotMatch(contextSource, /read stitch\/DESIGN_DOM\.json for the full behavior contract/);

    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    assert.doesNotMatch(stepOps, /read stitch\/DESIGN_DOM\.json for full DOM/);
    assert.match(stepOps, /use injected UI behavior contract instead of reading full DESIGN_DOM\.json/);
  });

  it("scope gate treats shared_files as read-only context, not completion-allowed files", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/guards.js"), "utf-8");
    assert.match(source, /SELECT scope_files, shared_files FROM stories WHERE id/);
    assert.match(source, /const declaredSharedFiles = parseScopeFiles\(scopeRow\?\.shared_files\)/);
    assert.doesNotMatch(source, /declaredSharedFiles\.forEach\(f => allowed\.add\(f\)\)/);
    assert.match(source, /void declaredSharedFiles/);

    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    assert.match(stepOps, /cleanupOutOfScopeWorktreeFiles/);
    assert.match(stepOps, /vite\.config\.\*, tailwind\.config\.\*, tsconfig\.\*, index\.html/);
    assert.doesNotMatch(stepOps, /src\/types\/\* shared API files are also allowed/);

    const guards = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/guards.js"), "utf-8");
    assert.doesNotMatch(guards, /src\\\/types\\\/\.\*/);

    const worktreeOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/worktree-ops.js"), "utf-8");
    assert.doesNotMatch(worktreeOps, /src\/types\/\*/);
  });

  it("treats shared type/domain files as out of scope unless explicitly owned", () => {
    const changed = [
      "src/screens/GameBoard.tsx",
      "src/types/domain.ts",
      "src/screens/GameBoard.test.tsx",
      "vitest.config.ts",
    ];

    assert.deepEqual(getOutOfScopeStoryFiles(changed, ["src/screens/GameBoard.tsx"]), [
      "src/types/domain.ts",
    ]);
    assert.deepEqual(getOutOfScopeStoryFiles(changed, ["src/screens/GameBoard.tsx", "src/types/domain.ts"]), []);
  });

  it("allows shared test helpers through the scope gate", () => {
    const changed = [
      "src/App.tsx",
      "src/test/utils.tsx",
      "src/test/setup.mts",
      "src/types/domain.test.ts",
    ];

    assert.deepEqual(getOutOfScopeStoryFiles(changed, ["src/App.tsx"]), []);
  });


  it("parses git porcelain dirty paths without trimming away the status columns", () => {
    assert.equal(parseGitStatusPorcelainPath(" M src/App.tsx"), "src/App.tsx");
    assert.equal(parseGitStatusPorcelainPath("M  src/hooks/useAppState.ts"), "src/hooks/useAppState.ts");
    assert.equal(parseGitStatusPorcelainPath("?? src/types/domain.test.ts"), "src/types/domain.test.ts");
    assert.equal(parseGitStatusPorcelainPath("R  src/Old.tsx -> src/New.tsx"), "src/New.tsx");
  });

  it("blocks SCOPE_BLEED completion instead of silently accepting it", () => {
    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    assert.match(stepOps, /scope-bleed-cleanup/);
    assert.match(stepOps, /failing story for retry/);
    assert.match(stepOps, /await failStep\(stepId, scopeResult\.reason\)/);
    assert.doesNotMatch(stepOps, /scope-bleed-silent/);
    assert.doesNotMatch(stepOps, /story kept DONE/);
    assert.doesNotMatch(stepOps, /kept DONE despite scope bleed/);
  });

  it("cleans dirty out-of-scope files before reusing a story worktree", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-clean-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/utils"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      fs.writeFileSync(path.join(tmp, "src/screens/GameBoard.tsx"), "export const board = 'base';\n");
      fs.writeFileSync(path.join(tmp, "tsconfig.json"), "{}\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "baseline"]);

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'allowed';\n");
      fs.writeFileSync(path.join(tmp, "src/utils/storage.ts"), "export const storage = true;\n");
      fs.writeFileSync(path.join(tmp, "src/screens/GameBoard.tsx"), "export const board = 'dirty';\n");
      fs.writeFileSync(path.join(tmp, "src/screens/Extra.tsx"), "export const extra = true;\n");
      fs.writeFileSync(path.join(tmp, "tsconfig.json"), "{\"dirty\":true}\n");

      const cleaned = cleanupOutOfScopeWorktreeFiles(tmp, ["src/App.tsx", "src/utils/storage.ts"], "US-001", "run-test");

      assert.ok(cleaned.includes("src/screens/GameBoard.tsx"));
      assert.ok(cleaned.includes("src/screens/Extra.tsx"));
      assert.ok(cleaned.includes("tsconfig.json"));
      assert.equal(fs.readFileSync(path.join(tmp, "src/App.tsx"), "utf-8"), "export const app = 'allowed';\n");
      assert.equal(fs.readFileSync(path.join(tmp, "src/utils/storage.ts"), "utf-8"), "export const storage = true;\n");
      assert.equal(fs.readFileSync(path.join(tmp, "src/screens/GameBoard.tsx"), "utf-8"), "export const board = 'base';\n");
      assert.equal(fs.existsSync(path.join(tmp, "src/screens/Extra.tsx")), false);
      assert.equal(fs.readFileSync(path.join(tmp, "tsconfig.json"), "utf-8"), "{}\n");

      const status = git(tmp, ["status", "--porcelain"]);
      assert.match(status, /M src\/App\.tsx/);
      assert.match(status, /\?\? src\/utils\//);
      assert.doesNotMatch(status, /src\/screens/);
      assert.doesNotMatch(status, /tsconfig/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("React Vite stack rules allow main.tsx only when scoped", () => {
    const rules = STACK_RULES["react-vite"].pitfalls;
    assert.ok(rules.includes("If it is listed in SCOPE_FILES, it is yours to wire"));
    assert.ok(rules.includes("If it is not listed in SCOPE_FILES, treat it as read-only context"));
    assert.equal(rules.includes("do NOT declare it as an OWNED file"), false);
  });

  it("prompt requires runtime window.app bridge when accepted by story contract", () => {
    const prompt = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/06-implement/prompt.md"), "utf-8");
    assert.match(prompt, /implement it\s+as a real runtime test bridge/i);
    assert.match(prompt, /`window\.app = \{ state, actions \}`/);
    assert.match(prompt, /`globalThis\.app = \{ state, actions \}`/);
    assert.match(prompt, /type declarations, comments, `window\.game`, and prose about a\s+bridge do not count/i);
    assert.match(prompt, /requested game's score\/progress/i);
    assert.match(prompt, /gameplay\s+entities/i);
    assert.match(prompt, /active\s+screen\/route, selected record, counts, storage status, last error/i);
    assert.match(prompt, /Supervisor Memory/i);
    assert.match(prompt, /Stack Contract/i);
    assert.match(prompt, /resolved by Setfarm before implementation/i);
    assert.match(prompt, /Stack-Specific Implementation Rules/i);
    assert.match(prompt, /Stack Verification Contract/i);
    assert.match(prompt, /Selected Library Packs/i);
    assert.match(prompt, /library packs were selected by Setfarm from the PRD, design contract, and resolved stack/i);
    assert.match(prompt, /Library-Specific Implementation Rules/i);
    assert.match(prompt, /do not invent props/i);
    assert.match(prompt, /If TypeScript says a prop does not exist on a shared component/i);
    assert.match(prompt, /Generated Stitch screen components may declare an `actions` prop/i);
    assert.match(prompt, /do not infer actions from `textContent`/i);
    assert.match(prompt, /treat them as additive integration surfaces/i);
    assert.match(prompt, /Preserve every existing reachable render branch/i);
    assert.match(prompt, /do not use `read`, `cat`, `sed`, `head`, `tail`, `rg`, `grep`, `find`, `awk`, `node`, or `python` on that `src\/screens\/\*\.tsx` file/i);
    assert.match(prompt, /Read generated screen source only when that exact `src\/screens\/\*\.tsx` file is listed in SCOPE_FILES/i);
    assert.doesNotMatch(prompt, /If exact detail is\s+still needed, inspect one relevant file/i);
    assert.match(prompt, /Reducers and state transition functions must be pure/i);
    assert.match(prompt, /`vite\.config\.\*` is app\/toolchain config and is forbidden/i);
    assert.match(prompt, /Do not edit `index\.html` for title, Google fonts, icon fonts, metadata, or root markup/i);
    assert.match(prompt, /Shared domain\/type files \(`src\/types\/\*`, `src\/types\.ts`, domain model files\) are read-only unless they are explicitly listed in SCOPE_FILES/i);
    assert.match(prompt, /local display\/render type or adapter/i);
    assert.match(prompt, /do not render movement,\s+pickup\/drop, pause, or other gameplay-only controls as active buttons/i);
    assert.match(prompt, /On menu, help, paused,\s+game-over, empty, loading, or inactive screens/i);
  });

  it("buildPrompt is the loop source of truth for implement instructions", () => {
    const result = implementModule.buildPrompt({ runId: "r1", task: "anything", context: { repo: "/x" } });
    assert.match(result, /# Developer Task/);
    assert.match(result, /Setfarm commits the allowed story scope/);
    assert.doesNotMatch(result, /Commit and push your changes/);
  });

  it("loop claims use step module buildPrompt instead of stale workflow fallback", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");
    assert.match(source, /Step module takeover for loop claims/);
    assert.match(source, /withStepModulePromptAliases/);
    assert.match(source, /assign\("SCOPE_FILES", "story_scope_files"\)/);
    assert.match(source, /assign\("STORY_ROADMAP", "story_roadmap"\)/);
    assert.match(source, /assign\("STORY", "current_story"\)/);
    assert.match(source, /loop buildPrompt override/);
    assert.ok(source.includes("resolveTemplate(_modulePrompt, renderContext)"));
    assert.ok(source.includes("await resolveLoopClaimInput(step, prunedContextLoop, context)"));
  });

  it("resets story scope context before each loop claim", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");
    const scopeRead = source.indexOf("SELECT scope_files, shared_files, scope_description");
    const baseRepo = source.indexOf("const baseRepo = context[\"repo\"] || context[\"REPO\"] || \"\";", scopeRead);
    assert.notEqual(scopeRead, -1, "scope row lookup should exist");
    assert.notEqual(baseRepo, -1, "base repo line should exist after scope row lookup");
    const block = source.slice(scopeRead, baseRepo);
    assert.match(block, /delete context\["story_scope_files"\]/);
    assert.match(block, /delete context\["story_shared_files"\]/);
    assert.match(block, /delete context\["scope_reminder"\]/);
  });

  it("sets pr-each story diff base for story-scoped supervisor audits", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");
    assert.match(source, /const storyDiffBase = \(lcCheck\.mergeStrategy === "pr-each" \|\| lcCheck\.verifyEach\)/);
    assert.match(source, /context\["story_diff_base"\] = storyDiffBase/);
    assert.match(source, /context\["story_diff_base"\] = \(loopConfig\.mergeStrategy === "pr-each" \|\| loopConfig\.verifyEach\)/);
  });

  it("cleans dirty worktrees after failed scope attempts before retry", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");
    assert.match(source, /discardDirtyRetryWorktreeState/);
    assert.match(source, /scopeResult\.category === "RETRY_PATCH_REAPPLIED"/);
    assert.match(source, /scopeResult\.category === "NO_WORK_DETECTED"/);
    assert.match(source, /implement\.failed_scope_attempt_cleanup/);
    assert.match(source, /Failed scope attempt cleanup/);

    const guardStart = source.indexOf("const shouldDiscardFailedScopeAttempt");
    const guardEnd = source.indexOf("applyRetryFailureContext(context, scopeResult.reason!", guardStart);
    assert.notEqual(guardStart, -1, "retry patch cleanup block missing");
    assert.notEqual(guardEnd, -1, "retry patch cleanup block end missing");
    const block = source.slice(guardStart, guardEnd);
    assert.match(block, /discardDirtyRetryWorktreeState\(wd,\s*storyRow\.story_id,\s*step\.run_id\)/);
    assert.ok(
      block.indexOf("discardDirtyRetryWorktreeState") < block.indexOf("recordLiveObservation"),
      "cleanup should happen before recording pass observation",
    );
  });

  it("allows zero-work retries when the story branch is already integrated in the base branch", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");
    const helper = source.indexOf("async function storyAlreadyIntegratedInBase");
    const scopeCheck = source.indexOf("let scopeResult = await checkScopeEnforcement");
    const integratedCheck = source.indexOf("storyAlreadyIntegratedInBase({", scopeCheck);
    const observation = source.indexOf("recordImplementGateObservation(step, storyRow, \"implement.scope_enforcement\"", scopeCheck);

    assert.notEqual(helper, -1, "story integration helper should exist");
    assert.notEqual(scopeCheck, -1, "scope enforcement call should exist");
    assert.notEqual(integratedCheck, -1, "integrated zero-work check should exist after scope enforcement");
    assert.notEqual(observation, -1, "scope observation should exist after integration adjustment");
    assert.ok(integratedCheck > scopeCheck, "integration check must run after scope enforcement result");
    assert.ok(integratedCheck < observation, "integration check must adjust the result before recording the gate observation");
    assert.match(source, /NO_WORK_ALREADY_INTEGRATED/);
    assert.match(source, /merge-base", "--is-ancestor"/);
  });

  it("injectContext is a no-op (real work happens in injectStoryContext post-selection)", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await implementModule.injectContext({
      runId: "r1", stepId: "implement", task: "t", context,
    });
    assert.deepEqual(context, { foo: "bar" });
  });

  it("validateOutput rejects missing STATUS", () => {
    const r = validateOutput({} as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("STATUS")));
  });

  it("validateOutput accepts STATUS: retry (no extra fields needed)", () => {
    assert.equal(validateOutput({ status: "retry" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects STATUS: done without CHANGES or STORY_BRANCH", () => {
    const r = validateOutput({ status: "done" } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("CHANGES or STORY_BRANCH")));
  });

  it("validateOutput accepts STATUS: done when CHANGES is set", () => {
    const r = validateOutput({ status: "done", changes: "src/App.tsx modified" } as ParsedOutput);
    assert.equal(r.ok, true);
  });

  it("normalize treats common summary fields as CHANGES", () => {
    const parsed = { status: "done", summary: "Implemented scoped files" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["changes"], "Implemented scoped files");
    assert.equal(validateOutput(parsed).ok, true);
  });

  it("validateOutput accepts STATUS: done when STORY_BRANCH is set", () => {
    const r = validateOutput({ status: "done", story_branch: "story-US-001" } as ParsedOutput);
    assert.equal(r.ok, true);
  });

  it("normalize extracts first word, lowercase, multi-line STATUS leak fix", () => {
    const parsed = { status: "DONE\nSome trailing narrative text" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "done");
  });

  it("normalize trims whitespace around STATUS", () => {
    const parsed = { status: "  retry  " } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "retry");
  });

  it("normalize leaves STATUS untouched when absent", () => {
    const parsed = { changes: "x" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], undefined);
  });

  it("expands scope overflow limits for large planner-owned single-story scopes", () => {
    const declaredScope = [
      "src/screens/HomeCounter.tsx",
      "src/screens/ErrorStateFallback.tsx",
      "src/screens/EmptyInitialState.tsx",
      "src/components/CounterDisplay/CounterDisplay.tsx",
      "src/components/CounterDisplay/CounterDisplay.module.css",
      "src/components/ActionButtons/ActionButtons.tsx",
      "src/components/ActionButtons/ActionButtons.module.css",
      "src/components/ResetButton/ResetButton.tsx",
      "src/components/ResetButton/ResetButton.module.css",
      "src/hooks/useCounter.ts",
      "src/types/counter.ts",
      "src/utils/storage.ts",
      "src/App.tsx",
      "src/App.css",
      "src/main.tsx",
      "src/index.css",
    ];

    const { hardLimit, softLimit } = computeScopeFileLimits(false, declaredScope);
    assert.ok(hardLimit >= 22, `hard limit ${hardLimit} should cover declared files plus test helpers`);
    assert.ok(softLimit >= 16, `soft limit ${softLimit} should scale with hard limit`);
  });

  it("expands scope overflow limits for shared Stitch screen wiring", () => {
    const appScope = [
      "src/App.tsx",
      "src/App.css",
      "src/main.tsx",
      "src/index.css",
      "src/types/domain.ts",
      "src/hooks/useAppState.ts",
      "src/utils/storage.ts",
    ];
    const sharedScreens = [
      "src/screens/LeadEditor.tsx",
      "src/screens/LeadList.tsx",
      "src/screens/InsightsDashboard.tsx",
      "src/screens/SettingsScreen.tsx",
      "src/screens/EmptyState.tsx",
      "src/screens/ErrorState.tsx",
      "src/screens/PipelineBoard.tsx",
      "src/screens/ProfilePanel.tsx",
    ];

    const withShared = computeScopeFileLimits(false, appScope, sharedScreens);
    const withoutShared = computeScopeFileLimits(false, appScope);
    assert.equal(withShared.hardLimit, withoutShared.hardLimit, "shared_files must not inflate writable scope limits");
    assert.equal(withShared.softLimit, withoutShared.softLimit, "shared_files must remain read-only context");

    const implicitTestAndConfig = [
      "src/App.test.tsx",
      "src/hooks/useAppState.test.ts",
      "src/test/storage.test.ts",
      "src/test/setup.ts",
      "src/setupTests.ts",
      "vitest.config.ts",
      "jest.config.ts",
      "jest.config.js",
    ];
    const { hardLimit, softLimit } = computeScopeFileLimits(false, appScope, sharedScreens, implicitTestAndConfig);
    assert.ok(hardLimit >= 20, `hard limit ${hardLimit} should cover app shell and implicit test/config files`);
    assert.ok(softLimit >= 14, `soft limit ${softLimit} should scale with writable and implicit file count`);
  });

  it("checks critical UI contracts only against the story scope when scope is available", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-contract-scope-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "stitch/design-tokens.css"), ":root { --color-background: #000; }\n");
      fs.writeFileSync(path.join(tmp, "src/index.css"), "@import '../stitch/design-tokens.css';\n");
      fs.writeFileSync(path.join(tmp, "src/screens/Allowed.tsx"), "export function Allowed() { return <span>Clean</span>; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/Legacy.tsx"), "export function Legacy() { return <button className=\"transition-all\"><span className=\"material-symbols-outlined\">warning</span></button>; }\n");

      assert.equal(checkStoryDesignCompliance({
        repo: tmp,
        story_workdir: tmp,
        story_scope_files: "src/screens/Allowed.tsx",
      }), null);

      const scopedContractFailure = checkStoryDesignCompliance({
        repo: tmp,
        story_workdir: tmp,
        story_scope_files: "src/screens/Legacy.tsx",
      }) || "";
      assert.match(scopedContractFailure, /CRITICAL DESIGN CONTRACT/);
      assert.match(scopedContractFailure, /inline SVG components or an installed SVG icon library/);
      assert.match(scopedContractFailure, /transition-colors, transition-transform, transition-opacity/);
      assert.doesNotMatch(scopedContractFailure, /hardcoded colors|import stitch\/design-tokens\.css/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("catches scoped screen controls that drift from DESIGN_DOM before verify retries are spent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-dom-gate-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "pause-1", title: "Pause Overlay", file: "src/screens/PauseOverlay.tsx" },
        { screenId: "over-1", title: "Game Over", file: "src/screens/GameOver.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: [
          {
            screenId: "pause-1",
            title: "Pause Overlay",
            buttons: [{ label: "SUPERVISOR", action: "click-action" }],
            navLinks: [{ label: "terminal", href: "#", icon: "terminal" }],
          },
          {
            screenId: "over-1",
            title: "Game Over",
            buttons: [
              { label: "REBOOT SESSION", icon: "restart_alt", action: "reset" },
              { label: "DISCONNECT (MAIN MENU)", icon: "logout", action: "navigate" },
            ],
            navLinks: [],
          },
        ],
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/PauseOverlay.tsx"), [
        "export function PauseOverlay() {",
        "  return <nav>",
        "    <div>SUPERVISOR</div>",
        "    <a aria-current=\"page\"><span data-icon=\"terminal\" />TERMINAL</a>",
        "  </nav>;",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/screens/GameOver.tsx"), [
        "import { Circle } from 'lucide-react';",
        "export function GameOver({ actions }: any) {",
        "  return <main>",
        "    <button type=\"button\" onClick={actions?.restart}><Circle />REBOOT SESSION</button>",
        "    <button type=\"button\" onClick={actions?.menu}><Circle />DISCONNECT (MAIN MENU)</button>",
        "  </main>;",
        "}",
        "",
      ].join("\n"));

      const findings = findDesignDomImplementationFindings(tmp, [
        "src/screens/PauseOverlay.tsx",
        "src/screens/GameOver.tsx",
      ]);
      const issues = findings.filter((finding: any) => finding.severity === "blocker").map((finding: any) => finding.message);
      const warnings = findings.filter((finding: any) => finding.severity === "warning").map((finding: any) => finding.message);

      assert.ok(issues.some((issue) => issue.includes('SUPERVISOR_CHECKLIST button "SUPERVISOR" is static') || issue.includes('missing button "SUPERVISOR"')), issues.join("\n"));
      assert.ok(issues.some((issue) => issue.includes('link "terminal" lacks href="#"')), issues.join("\n"));
      assert.ok(warnings.some((issue) => issue.includes('expected icon "restart_alt"')), warnings.join("\n"));
      assert.ok(warnings.some((issue) => issue.includes('expected icon "logout"')), warnings.join("\n"));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts Lucide SVG aliases for common Material DESIGN_DOM icon names", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-dom-icon-aliases-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "main-1", title: "Main Menu", file: "src/screens/MainMenu.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: [
          {
            screenId: "main-1",
            title: "Main Menu",
            buttons: [
              { label: "Start New Game", icon: "sports_esports", action: "start" },
              { label: "Resume", icon: "play_circle", action: "resume" },
              { label: "How to Play", icon: "menu_book", action: "help" },
              { icon: "arrow_drop_up", action: "up" },
              { icon: "arrow_drop_down", action: "down" },
            ],
            navLinks: [],
          },
        ],
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), [
        "import { BookOpen, ChevronDown, ChevronUp, CirclePlay, Gamepad2 } from 'lucide-react';",
        "export function MainMenu({ actions }: any) {",
        "  return <main>",
        "    <button type=\"button\" onClick={actions?.start}><Gamepad2 />Start New Game</button>",
        "    <button type=\"button\" onClick={actions?.resume}><CirclePlay />Resume</button>",
        "    <button type=\"button\" onClick={actions?.help}><BookOpen />How to Play</button>",
        "    <button type=\"button\" onClick={actions?.up}><ChevronUp aria-label=\"up\" /></button>",
        "    <button type=\"button\" onClick={actions?.down}><ChevronDown aria-label=\"down\" /></button>",
        "  </main>;",
        "}",
        "",
      ].join("\n"));

      const issues = findDesignDomImplementationIssues(tmp, ["src/screens/MainMenu.tsx"]);

      assert.deepEqual(issues, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not match icon aliases inside CSS words or force display-only title controls to be actions", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-dom-title-alias-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "main-1", title: "Main Menu", file: "src/screens/MainMenu.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: [
          {
            screenId: "main-1",
            title: "Main Menu",
            buttons: [
              { label: "Resume", icon: "play_circle", classes: ["h-touch-target"], action: "resume" },
            ],
            navLinks: [],
          },
        ],
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), [
        "import { PlayCircle } from 'lucide-react';",
        "export function MainMenu({ actions }: any) {",
        "  return <main>",
        "    <h1 className=\"font-display-score text-display-score\">PONG ARCADE</h1>",
        "    <button type=\"button\" onClick={actions?.resume}><PlayCircle />Resume</button>",
        "  </main>;",
        "}",
        "",
      ].join("\n"));

      const issues = findDesignDomImplementationIssues(tmp, ["src/screens/MainMenu.tsx"]);

      assert.deepEqual(issues, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("allows explicitly inert DESIGN_DOM hash anchors when href and aria state are preserved", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-dom-anchor-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "pause-1", title: "Pause Overlay", file: "src/screens/PauseOverlay.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: [
          {
            screenId: "pause-1",
            title: "Pause Overlay",
            buttons: [],
            navLinks: [
              { label: "terminal", href: "#", icon: "terminal" },
              { label: "RECORDS", href: "#", icon: "emoji_events" },
            ],
          },
        ],
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/PauseOverlay.tsx"), [
        "import { Terminal, Trophy } from 'lucide-react';",
        "export function PauseOverlay() {",
        "  return <nav>",
        "    <a href=\"#\" aria-current=\"page\"><Terminal />TERMINAL</a>",
        "    <a href=\"#\" aria-disabled=\"true\" tabIndex={-1}><Trophy />RECORDS</a>",
        "  </nav>;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findDesignDomImplementationIssues(tmp, ["src/screens/PauseOverlay.tsx"]), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks screen stories when owned generated screens are not rendered by the app surface", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-screen-integration-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "main-menu", title: "Main Menu", componentName: "MainMenu", file: "src/screens/MainMenu.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), [
        "export function MainMenu({ actions }: any) {",
        "  return <button type=\"button\" onClick={actions?.start}>Start Game</button>;",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "export default function App() {",
        "  return <button type=\"button\">Start Game</button>;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenIntegrationIssues(
        tmp,
        ["src/screens/MainMenu.tsx", "src/App.tsx"],
        [{ screenId: "main-menu", name: "Main Menu", type: "menu" }],
      );

      assert.equal(issues.length, 1);
      assert.match(issues[0], /GENERATED_SCREEN_NOT_INTEGRATED/);
      assert.match(issues[0], /MainMenu \(src\/screens\/MainMenu\.tsx\)/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts screen stories when owned generated screens are rendered through a barrel import", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-screen-rendered-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "main-menu", title: "Main Menu", componentName: "MainMenu", file: "src/screens/MainMenu.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/index.ts"), "export { MainMenu } from './MainMenu';\n");
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), [
        "export function MainMenu({ actions }: any) {",
        "  return <button type=\"button\" onClick={actions?.start}>Start Game</button>;",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { MainMenu } from './screens';",
        "export default function App({ actions }: any) {",
        "  return <MainMenu actions={{ start: actions?.start }} />;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(
        findGeneratedScreenIntegrationIssues(
          tmp,
          ["src/screens/MainMenu.tsx", "src/App.tsx"],
          [{ screenId: "main-menu", name: "Main Menu", type: "menu" }],
        ),
        [],
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks later screen stories when they remove previously verified generated screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-screen-regression-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "main-menu", title: "Main Menu", componentName: "MainMenu", file: "src/screens/MainMenu.tsx" },
        { screenId: "game-options", title: "Game Options", componentName: "GameOptions", file: "src/screens/GameOptions.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), "export function MainMenu() { return <div>Main</div>; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/GameOptions.tsx"), "export function GameOptions() { return <div>Options</div>; }\n");
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { GameOptions } from './screens/GameOptions';",
        "export default function App() {",
        "  return <GameOptions />;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenRegressionIssues(
        tmp,
        [[{ screenId: "main-menu", name: "Main Menu", type: "menu" }]],
      );

      assert.equal(issues.length, 1);
      assert.match(issues[0], /GENERATED_SCREEN_REGRESSION/);
      assert.match(issues[0], /MainMenu \(src\/screens\/MainMenu\.tsx\)/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts later screen stories when previous generated screens stay rendered", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-screen-regression-ok-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "main-menu", title: "Main Menu", componentName: "MainMenu", file: "src/screens/MainMenu.tsx" },
        { screenId: "game-options", title: "Game Options", componentName: "GameOptions", file: "src/screens/GameOptions.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), "export function MainMenu() { return <div>Main</div>; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/GameOptions.tsx"), "export function GameOptions() { return <div>Options</div>; }\n");
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { MainMenu } from './screens/MainMenu';",
        "import { GameOptions } from './screens/GameOptions';",
        "export default function App({ screen }: { screen: string }) {",
        "  return screen === 'settings' ? <GameOptions /> : <MainMenu />;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(
        findGeneratedScreenRegressionIssues(
          tmp,
          [[{ screenId: "main-menu", name: "Main Menu", type: "menu" }]],
        ),
        [],
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks later app integration stories when they remove prior screen adapters", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-screen-adapter-regression-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "gameplay", title: "Gameplay", componentName: "GameplayScreen", file: "src/screens/GameplayScreen.tsx" },
        { screenId: "settings", title: "Settings", componentName: "SettingsScreen", file: "src/screens/SettingsScreen.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/GameplayScreen.tsx"), "export function GameplayScreen() { return <div>Gameplay</div>; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/SettingsScreen.tsx"), "export function SettingsScreen() { return <div>Settings</div>; }\n");
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { useEffect } from 'react';",
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "import { SettingsScreen } from './screens/SettingsScreen';",
        "import { actStartGame } from './features/surf-gameplay/act_start_game';",
        "export default function App({ state, actions }: any) {",
        "  useEffect(() => { window.addEventListener('keydown', () => actStartGame(actions)); }, [actions]);",
        "  return state.view === 'settings' ? <SettingsScreen /> : <GameplayScreen actions={{ start: () => actStartGame(actions) }} runtime={state} />;",
        "}",
        "",
      ].join("\n"));
      execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: tmp, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: tmp, stdio: "ignore" });
      execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
      execFileSync("git", ["commit", "-m", "prior gameplay integration"], { cwd: tmp, stdio: "ignore" });

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "import { SettingsScreen } from './screens/SettingsScreen';",
        "import { actSavePreferences } from './features/surf-settings/act_save_preferences';",
        "export default function App({ state, actions }: any) {",
        "  return state.view === 'settings' ? <SettingsScreen actions={{ save: () => actSavePreferences(actions) }} /> : <GameplayScreen actions={actions} />;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenRegressionIssues(
        tmp,
        [[{ screenId: "gameplay", name: "Gameplay", type: "game" }]],
        "",
        ["src/screens/SettingsScreen.tsx", "src/features/surf-settings/act_save_preferences.ts", "src/App.tsx"],
      );

      assert.equal(issues.some((issue) => issue.includes("APP_INTEGRATION_SCOPE_REGRESSION")), true);
      assert.equal(issues.some((issue) => issue.includes("APP_INTEGRATION_PROP_REGRESSION") && issue.includes("runtime")), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks later app integration stories when they remove prior semantic UI contracts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-screen-semantic-regression-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "gameplay", title: "Gameplay", componentName: "GameplayScreen", file: "src/screens/GameplayScreen.tsx" },
        { screenId: "settings", title: "Settings", componentName: "SettingsScreen", file: "src/screens/SettingsScreen.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/GameplayScreen.tsx"), "export function GameplayScreen() { return <div>Gameplay</div>; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/SettingsScreen.tsx"), "export function SettingsScreen() { return <div>Settings</div>; }\n");
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "import { SettingsScreen } from './screens/SettingsScreen';",
        "export default function App({ state }: any) {",
        "  return <><div role=\"status\" aria-live=\"polite\" data-testid=\"setfarm-action-status\">Gameplay ready</div>{state.view === 'settings' ? <SettingsScreen /> : <GameplayScreen />}</>;",
        "}",
        "",
      ].join("\n"));
      execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: tmp, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: tmp, stdio: "ignore" });
      execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
      execFileSync("git", ["commit", "-m", "prior semantic integration"], { cwd: tmp, stdio: "ignore" });

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "import { SettingsScreen } from './screens/SettingsScreen';",
        "export default function App({ state }: any) {",
        "  return state.view === 'settings' ? <SettingsScreen /> : <GameplayScreen />;",
        "}",
        "",
      ].join("\n"));

      const issues = findGeneratedScreenRegressionIssues(
        tmp,
        [[{ screenId: "gameplay", name: "Gameplay", type: "game" }]],
        "",
        ["src/screens/SettingsScreen.tsx", "src/App.tsx"],
      );

      assert.equal(issues.some((issue) => issue.includes("APP_INTEGRATION_SEMANTIC_REGRESSION") && issue.includes("data-testid=setfarm-action-status")), true);
      assert.equal(issues.some((issue) => issue.includes("APP_INTEGRATION_SEMANTIC_REGRESSION") && issue.includes("aria-live=polite")), true);
      assert.equal(issues.some((issue) => issue.includes("APP_INTEGRATION_SEMANTIC_REGRESSION") && issue.includes("role=status")), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks Setfarm platform helper contamination in generated app source", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-helper-contamination-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "export const isTilingBackgroundRepeat = (value?: unknown) => Boolean(value);",
        "globalThis.isTilingBackgroundRepeat = isTilingBackgroundRepeat;",
        "export default function App() { return <main />; }",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.test.tsx"), [
        "it('allows test-only mentions', () => {",
        "  expect('isTilingBackgroundRepeat').toBeTruthy();",
        "});",
        "",
      ].join("\n"));

      const issues = findPlatformHelperContaminationIssues(tmp);
      assert.equal(issues.length, 1);
      assert.match(issues[0], /PLATFORM_HELPER_CONTAMINATION/);
      assert.match(issues[0], /src\/App\.tsx/);

      const gate = checkPlatformHelperContaminationGate("US-002", "Gameplay", tmp);
      assert.equal(gate.passed, false);
      assert.equal(gate.category, "PLATFORM_HELPER_CONTAMINATION");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts normal generated app source without Setfarm platform helpers", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-helper-clean-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "export default function App() {",
        "  window.app = { status: 'ready', actions: {} };",
        "  return <main data-setfarm-root=\"demo\" />;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findPlatformHelperContaminationIssues(tmp), []);
      assert.equal(checkPlatformHelperContaminationGate("US-001", "App", tmp).passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("detects package build scripts for implement build gate", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-build-gate-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ scripts: { build: "node -e \"process.exit(0)\"" } }));
      assert.deepEqual(detectPackageBuildCommand(tmp), ["npm", "run", "build"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fails implement build gate when npm run build fails", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-build-gate-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
        scripts: { build: "node -e \"console.error('synthetic build failure'); process.exit(2)\"" },
      }));
      const result = checkBuildGate("US-001", "Failing Build", tmp, 0, 3);
      assert.equal(result.passed, false);
      assert.equal(result.category, "BUILD_FAILED");
      assert.match(result.reason || "", /synthetic build failure|Command failed/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("detects real window.app runtime bridge assignments only", () => {
    assert.equal(sourceExposesWindowApp("window.app = { score: 10 };\n"), true);
    assert.equal(sourceExposesWindowApp("globalThis['app'] = bridge;\n"), true);
    assert.equal(sourceExposesWindowApp("(window as any).app = bridge;\n"), true);
    assert.equal(sourceExposesWindowApp("(window as unknown as Record<string, unknown>).app = bridge;\n"), true);
    assert.equal(sourceExposesWindowApp("(globalThis as any)['app'] = bridge;\n"), true);
    assert.equal(sourceExposesWindowApp("window.game = bridge;\n"), false);
    assert.equal(sourceExposesWindowApp("declare global { interface Window { app: unknown } }\n"), false);
    assert.equal(sourceExposesWindowApp("// window.app = bridge;\nconst ready = true;\n"), false);
    assert.equal(sourceExposesWindowApp("/* globalThis.app = bridge; */\nconst ready = true;\n"), false);
  });

  it("reports missing declared scope files with a dedicated category", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-file-category-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src", "App.tsx"), "export default function App() { return null; }\n");
      const storyId = "scope-file-story-" + Date.now();
      await pgRun(
        `INSERT INTO runs (id, workflow_id, task, status, created_at, updated_at)
         VALUES ($1, 'feature-dev', 'scope file category test', 'running', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        ["scope-file-run"],
      );
      await pgRun(
        `INSERT INTO stories (id, run_id, story_index, story_id, title, status, scope_files, created_at, updated_at)
         VALUES ($1, $2, 0, 'US-001', 'Scope File Story', 'running', $3, NOW(), NOW())`,
        [storyId, "scope-file-run", JSON.stringify(["src/App.tsx", "src/hooks/useAppState.ts", "src/types/domain.ts"])],
      );

      const result = await checkScopeFilesGate("US-001", storyId, "Scope File Story", tmp);
      assert.equal(result.passed, false);
      assert.equal(result.category, "SCOPE_FILE_MISSING");
      assert.match(result.reason || "", /SCOPE_FILE_MISSING/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      await pgRun("DELETE FROM stories WHERE run_id = $1", ["scope-file-run"]);
      await pgRun("DELETE FROM runs WHERE id = $1", ["scope-file-run"]);
    }
  });

  it("preserves missing scope files as retry feedback before later guardrails", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-retry-feedback-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src", "App.tsx"), "export default function App() { return null; }\n");

      const feedback = buildScopeFilesRetryFailureForWorkdir(
        "US-001",
        "Scope File Story",
        JSON.stringify(["src/App.tsx", "src/features/app.store.ts", "src/features/app.repo.ts", "src/index.css"]),
        tmp,
      );

      assert.match(feedback, /SCOPE_FILE_MISSING/);
      assert.match(feedback, /Before fixing later guardrails/);
      assert.match(feedback, /src\/features\/app\.store\.ts/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps distinct prior retry blockers together for clean retry worktrees", () => {
    const feedback = mergeRetryFailureTexts([
      "RUNTIME_BRIDGE_MISSING: add window.app from live runtime state.",
      "GENERATED_SCREEN_LAYOUT_MOUNT_UNSAFE: mount generated screens in a flex root.",
      "RUNTIME_BRIDGE_MISSING: add window.app from live runtime state.",
    ]);

    assert.match(feedback, /RUNTIME_BRIDGE_MISSING/);
    assert.match(feedback, /GENERATED_SCREEN_LAYOUT_MOUNT_UNSAFE/);
    assert.match(feedback, /ALSO_FIX/);
    assert.equal((feedback.match(/RUNTIME_BRIDGE_MISSING/g) || []).length, 1);
  });

  it("does not fail screen stories only because optional action companion files are absent", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-action-companions-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export default function App() { return null; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/VehicleEditor.tsx"), "export function VehicleEditor() { return null; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/VehicleOperations.tsx"), "export function VehicleOperations() { return null; }\n");
      const storyId = "scope-action-companion-story-" + Date.now();
      await pgRun(
        `INSERT INTO runs (id, workflow_id, task, status, created_at, updated_at)
         VALUES ($1, 'feature-dev', 'scope action companion test', 'running', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        ["scope-action-companion-run"],
      );
      await pgRun(
        `INSERT INTO stories (id, run_id, story_index, story_id, title, status, scope_files, created_at, updated_at)
         VALUES ($1, $2, 0, 'US-002', 'Screen Story', 'running', $3, NOW(), NOW())`,
        [storyId, "scope-action-companion-run", JSON.stringify([
          "src/screens/VehicleEditor.tsx",
          "src/features/surf-vehicle-editor/act_save_record.ts",
          "src/features/surf-vehicle-editor/act_cancel_edit.ts",
          "src/screens/VehicleOperations.tsx",
          "src/features/surf-vehicle-operations/act_search_records.ts",
          "src/features/surf-vehicle-operations/act_create_record.ts",
          "src/features/surf-vehicle-operations/act_select_record.ts",
          "src/features/surf-vehicle-operations/act_retry_load.ts",
          "src/App.tsx",
        ])],
      );

      const result = await checkScopeFilesGate("US-002", storyId, "Screen Story", tmp);
      assert.equal(result.passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      await pgRun("DELETE FROM stories WHERE run_id = $1", ["scope-action-companion-run"]);
      await pgRun("DELETE FROM runs WHERE id = $1", ["scope-action-companion-run"]);
    }
  });

  it("fails screen stories when the declared generated screen file is absent", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-required-screen-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export default function App() { return null; }\n");
      const storyId = "scope-required-screen-story-" + Date.now();
      await pgRun(
        `INSERT INTO runs (id, workflow_id, task, status, created_at, updated_at)
         VALUES ($1, 'feature-dev', 'scope required screen test', 'running', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        ["scope-required-screen-run"],
      );
      await pgRun(
        `INSERT INTO stories (id, run_id, story_index, story_id, title, status, scope_files, created_at, updated_at)
         VALUES ($1, $2, 0, 'US-003', 'Settings Screen Story', 'running', $3, NOW(), NOW())`,
        [storyId, "scope-required-screen-run", JSON.stringify([
          "src/screens/GameSettingsWingloopLite.tsx",
          "src/features/surf-game-settings/act_save_preferences.ts",
          "src/features/surf-game-settings/act_return_to_gameplay.ts",
          "src/App.tsx",
        ])],
      );

      const result = await checkScopeFilesGate("US-003", storyId, "Settings Screen Story", tmp);
      assert.equal(result.passed, false);
      assert.equal(result.category, "SCOPE_FILE_MISSING");
      assert.match(result.reason || "", /src\/screens\/GameSettingsWingloopLite\.tsx/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      await pgRun("DELETE FROM stories WHERE run_id = $1", ["scope-required-screen-run"]);
      await pgRun("DELETE FROM runs WHERE id = $1", ["scope-required-screen-run"]);
    }
  });

  it("prepares implement worktrees with safe design and reference corpus", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-safe-assets-"));
    try {
      const referenceSource = path.join(tmp, "reference-source");
      fs.mkdirSync(referenceSource, { recursive: true });
      fs.writeFileSync(path.join(referenceSource, "game-dev-guide.md"), "# full game guide\n".repeat(400));
      fs.symlinkSync(referenceSource, path.join(tmp, "references"), "dir");
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "stitch", "screen.html"), "<html>raw stitch</html>\n");
      fs.writeFileSync(path.join(tmp, "stitch", "screen.png"), "png bytes\n");
      fs.writeFileSync(path.join(tmp, "stitch", "DESIGN_DOM.json"), JSON.stringify({ raw: true }));
      fs.writeFileSync(path.join(tmp, "stitch", "UI_CONTRACT.json"), JSON.stringify([{ screen: "Main" }]));
      fs.writeFileSync(path.join(tmp, "stitch", "DESIGN_MANIFEST.json"), JSON.stringify([{ id: "screen" }]));
      fs.writeFileSync(path.join(tmp, "stitch", "SCREEN_MAP.json"), JSON.stringify([{ id: "screen" }]));
      fs.writeFileSync(path.join(tmp, "stitch", "design-tokens.css"), ":root { --color-bg: #000; }\n");
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ scripts: { build: "vite build" } }));
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "base"]);

      const worktree = createStoryWorktree(tmp, "44aa2211-us-001", "main");

      assert.ok(worktree);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "screen.html")), false);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "DESIGN_DOM.json")), false);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "screen.png")), false);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "UI_CONTRACT.json")), true);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "DESIGN_MANIFEST.json")), true);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "design-tokens.css")), true);
      assert.equal(fs.lstatSync(path.join(worktree, "references")).isSymbolicLink(), false);
      assert.equal(fs.existsSync(path.join(worktree, "references", "game-dev-guide.md")), false);
      assert.match(fs.readFileSync(path.join(worktree, "references", "README.md"), "utf-8"), /Full reference manuals are intentionally not mounted/);
      assert.equal(git(worktree, ["status", "--porcelain", "--", "references", "stitch"]).trim(), "");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks implement completion when touched tests fail", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-test-gate-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
        scripts: {
          "test:run": "node -e \"console.error('synthetic test failure'); process.exit(2)\"",
        },
        devDependencies: { vitest: "1.0.0" },
      }));
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "baseline"]);
      git(tmp, ["checkout", "-b", "story"]);

      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/failing.test.ts"), "import assert from 'node:assert/strict';\nassert.equal(1, 2);\n");
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "add failing test"]);

      const result = checkTestGate("US-001", "Failing Tests", tmp, "main", 0, 3);
      assert.equal(result.passed, false);
      assert.equal(result.category, "TEST_FAILED");
      assert.match(result.reason || "", /src\/failing\.test\.ts/);
      assert.match(result.reason || "", /synthetic test failure|Command failed/);
      assert.match(result.suggestion || "", /TEST FAILURES DETECTED/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not run test gate when story did not touch tests", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-test-gate-clean-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
        scripts: {
          "test:run": "node -e \"console.error('should not run'); process.exit(2)\"",
        },
        devDependencies: { vitest: "1.0.0" },
      }));
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "baseline"]);
      git(tmp, ["checkout", "-b", "story"]);

      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export function App() { return null; }\n");
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "add app"]);

      const result = checkTestGate("US-001", "No Test Touch", tmp, "main", 0, 3);
      assert.equal(result.passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("wires runtime bridge and touched-test gates into implement completion", () => {
    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    assert.match(stepOps, /const bridgeResult = await checkRuntimeBridgeGate/);
    assert.match(stepOps, /await failStep\(stepId, bridgeResult\.reason\)/);
    assert.match(stepOps, /const testResult = checkTestGate/);
    assert.match(stepOps, /await failStep\(stepId, testResult\.reason\)/);
    assert.match(stepOps, /const generatedScreenResult = await checkGeneratedScreenIntegrationGate/);
    assert.match(stepOps, /await failStep\(stepId, generatedScreenResult\.reason\)/);
    assert.match(stepOps, /const generatedScreenRegressionResult = await checkGeneratedScreenRegressionGate/);
    assert.match(stepOps, /await failStep\(stepId, generatedScreenRegressionResult\.reason\)/);
    assert.match(stepOps, /const generatedScreenShellChromeResult = checkGeneratedScreenShellChromeGate/);
    assert.match(stepOps, /await failStep\(stepId, generatedScreenShellChromeResult\.reason\)/);
    assert.match(stepOps, /const generatedScreenPropsResult = checkGeneratedScreenRequiredPropsGate/);
    assert.match(stepOps, /await failStep\(stepId, generatedScreenPropsResult\.reason\)/);
    assert.match(stepOps, /detectVerifyGeneratedScreenRegressionFailure/);
    assert.match(stepOps, /verify-generated-screen-regression-preflight/);
  });

  it("platform smoke gates resolve smoke-test from the active platform build", () => {
    const guards = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/06-implement/guards.ts"), "utf-8");
    const stepOps = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");
    const stepAdvance = fs.readFileSync(path.join(process.cwd(), "src/installer/step-advance.ts"), "utf-8");
    const combined = [guards, stepOps, stepAdvance].join("\n");
    assert.match(combined, /resolvePlatformScript\("smoke-test\.mjs"\)/);
    assert.doesNotMatch(combined, /\.openclaw["',\s]+["']setfarm-repo["',\s]+["']scripts["',\s]+["']smoke-test\.mjs/);
  });

  it("platform smoke gates rebuild before smoke-test to avoid stale dist artifacts", () => {
    const guards = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/06-implement/guards.ts"), "utf-8");
    const stepOps = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");
    assert.match(guards, /ensureSmokeBuildFresh\(workdir/);
    assert.match(guards, /QA_FIX_SMOKE_PREBUILD_FAILED/);
    assert.match(stepOps, /ensureSmokeBuildFresh\(repoPath/);
    assert.match(stepOps, /system-smoke-prebuild/);
  });

  it("defers full system smoke until later UI story owns the app surface", () => {
    const decision = decideStorySystemSmokeGate("US-001", [
      {
        story_id: "US-001",
        story_index: 0,
        status: "done",
        scope_files: JSON.stringify(["src/types/habit.ts", "src/hooks/useLocalStorage.ts"]),
      },
      {
        story_id: "US-002",
        story_index: 1,
        status: "pending",
        scope_files: JSON.stringify(["src/screens/Home.tsx", "src/App.tsx"]),
      },
    ]);

    assert.equal(decision.run, false);
    assert.match(decision.reason, /US-002/);
  });

  it("runs full system smoke for the last pending UI boundary story", () => {
    const decision = decideStorySystemSmokeGate("US-003", [
      {
        story_id: "US-001",
        story_index: 0,
        status: "verified",
        scope_files: JSON.stringify(["src/types/habit.ts"]),
      },
      {
        story_id: "US-002",
        story_index: 1,
        status: "verified",
        scope_files: JSON.stringify(["src/screens/Home.tsx"]),
      },
      {
        story_id: "US-003",
        story_index: 2,
        status: "done",
        scope_files: JSON.stringify(["src/App.tsx", "src/main.tsx", "src/index.css"]),
      },
    ]);

    assert.equal(decision.run, true);
  });

  it("uses declared scope_files for dynamically created QA-FIX stories missing from setup manifest", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-qa-fix-context-"));
    fs.mkdirSync(path.join(repo, ".setfarm", "setup"), { recursive: true });
    fs.writeFileSync(setupCertificatePath(repo), JSON.stringify({
      schema: "setfarm.setup-certificate.v1",
      runId: "run-qa-fix",
      projectName: "Repair App",
      projectSlug: "repair-app",
      platform: "web",
      techStack: "vite-react",
      stackPackId: "vite-react-web-app",
      commands: {},
      entrypoints: ["src/App.tsx"],
      setupOwnedFiles: [],
      forbiddenDuringImplement: ["package.json"],
      sharedFiles: ["src/App.tsx", "src/main.tsx", "src/index.css"],
      scaffoldSnapshot: [],
      generatedDesignFiles: [],
      designAuthority: {
        required: false,
        source: "none",
        screenMap: "",
        rules: [],
        conversionPolicy: "none",
        conversionNote: "",
      },
      fileTreeManifestPath: ".setfarm/setup/FILE_TREE_MANIFEST.json",
      sharedGrantsPath: ".setfarm/setup/SHARED_GRANTS.json",
      targetResolutionRules: {},
      dependencyEvidence: { requested: [], approved: [], installed: [], rejected: [] },
      dependencyResolutionPolicy: "setup_build_only",
      designImportValidate: { status: "pass", reportPath: ".setfarm/setup/DESIGN_IMPORT_VALIDATE.json", screensValidated: [], failedRules: [], fixesApplied: [] },
      sandboxPrewarm: {},
    }, null, 2));
    fs.writeFileSync(fileTreeManifestPath(repo), JSON.stringify({
      schema: "setfarm.file-tree-manifest.v1",
      runId: "run-qa-fix",
      stackPackId: "vite-react-web-app",
      resolvedTargets: [],
      dependencyPlan: { requested: [], approved: [], installed: [], rejected: [] },
      mockInjectionPoints: [],
      routeRegistrationPlan: [],
    }, null, 2));
    fs.writeFileSync(sharedGrantsPath(repo), JSON.stringify({
      schema: "setfarm.shared-grants.v1",
      version: 1,
      runId: "run-qa-fix",
      grants: [],
    }, null, 2));

    const context = assembleImplementContext({
      repo,
      runId: "run-qa-fix",
      storyId: "QA-FIX-001",
      storyRow: {
        scope_files: JSON.stringify(["src/App.tsx", "src/game/runtime.ts"]),
        implementation_contract: "{}",
      },
    });

    assert.deepEqual(context?.resolvedScopeFiles, ["src/App.tsx", "src/game/runtime.ts"]);
    assert.deepEqual(context?.readOnlyFiles, ["src/main.tsx", "src/index.css"]);
  });
});
