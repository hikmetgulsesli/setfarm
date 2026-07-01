import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeRetryFeedbackForCurrentSource } from "../src/installer/retry-feedback.js";

describe("retry feedback sanitization", () => {
  it("drops stale UI_CONTRACT feedback that no longer reproduces in current source", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-"));
    try {
      fs.mkdirSync(path.join(repo, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src/screens/GameBoard.tsx"), `
        /* Inline SVG icons - Material Symbols are not allowed per UI contract */
        export function GameBoard() {
          return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h16" /></svg>;
        }
      `);

      const feedback = [
        "DESIGN MISMATCH:",
        "src/screens/GameBoard.tsx:2 — UI_CONTRACT: Material Symbols/icon fonts are not allowed; replace with inline SVG components.",
        "FIX:",
        "• Replace Material Symbols/icon font/emoji icons with inline SVG components or an installed SVG icon library.",
      ].join("\n");

      assert.equal(sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo }), "");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("refreshes retry feedback when current source still has deterministic UI violations", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-active-"));
    try {
      fs.mkdirSync(path.join(repo, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src/screens/GameBoard.tsx"), `
        export function GameBoard() {
          return <span className="material-symbols-outlined transition-all">play_arrow</span>;
        }
      `);

      const feedback = [
        "DESIGN MISMATCH:",
        "src/screens/GameBoard.tsx:88 — UI_CONTRACT: Material Symbols/icon fonts are not allowed.",
        "FIX: Resolve the exact UI contract failures; import stitch/design-tokens.css and replace hardcoded colors with var(--*) tokens.",
      ].join("\n");

      const output = sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo });
      assert.match(output, /src\/screens\/GameBoard\.tsx:3 — UI_CONTRACT: Material Symbols\/icon fonts are not allowed/);
      assert.match(output, /blanket transition-all is not allowed/);
      assert.match(output, /inline SVG components/);
      assert.doesNotMatch(output, /design-tokens\.css|hardcoded colors/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("rewrites shared type retry advice when type files are outside story scope", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-scope-"));
    try {
      fs.writeFileSync(path.join(repo, ".story-scope-files"), "src/screens/GameBoard.tsx\nsrc/screens/MainMenu.tsx\n");
      const feedback = [
        "FEEDBACK:",
        "- src/screens/GameBoard.tsx:121 — ghost cell uses `as Cell`; update Cell type to include ghost variants.",
      ].join("\n");

      const output = sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo });
      assert.match(output, /keep the shared Cell type unchanged; use a local render\/display type in the owned screen/);
      assert.match(output, /SCOPE NOTE/);
      assert.match(output, /Do not edit shared domain\/type files/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("keeps shared type retry advice when type files are explicitly scoped", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-type-scope-"));
    try {
      fs.writeFileSync(path.join(repo, ".story-scope-files"), "src/screens/GameBoard.tsx\nsrc/types/domain.ts\n");
      const feedback = "- src/types/domain.ts:15 — update Cell type to include ghost variants.";

      const output = sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo });
      assert.match(output, /update Cell type to include ghost variants/);
      assert.doesNotMatch(output, /SCOPE NOTE/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("drops stale browser-game runtime feedback when current source is not a browser game", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-runtime-stale-"));
    try {
      fs.mkdirSync(path.join(repo, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "fixloop-smoke-board" }));
      fs.writeFileSync(path.join(repo, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { componentName: "StatusUtilityScreen", file: "src/screens/StatusUtilityScreen.tsx", title: "Status Utility" },
      ]));
      fs.writeFileSync(path.join(repo, "src/screens/StatusUtilityScreen.tsx"), [
        "export function StatusUtilityScreen({ actions }: any) {",
        "  return <main><button onClick={actions.refresh}>Refresh</button><span>Ready/Paused</span></main>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src/App.tsx"), [
        "import { StatusUtilityScreen } from './screens/StatusUtilityScreen';",
        "export default function App() {",
        "  return <StatusUtilityScreen actions={{ refresh() {} }} />;",
        "}",
      ].join("\n"));

      const feedback = [
        "BROWSER_GAME_RUNTIME_LOOP_MISSING: browser-game projects must wire a visible runtime loop with setInterval/requestAnimationFrame and a scheduled tick/advance/step/update action.",
        "Story US-002 reported STATUS: done while generated-screen runtime semantics are incomplete or misleading.",
      ].join("\n");

      assert.equal(sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo, workdir: repo }), "");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("drops browser-game retry feedback when stack contract resolves to web", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-stack-web-"));
    try {
      fs.mkdirSync(path.join(repo, ".setfarm/ledger"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".setfarm/ledger/stack-contract.json"), JSON.stringify({
        schema: "setfarm.stack-contract.v1",
        status: "resolved",
        packId: "vite-react-web-app",
      }));
      fs.mkdirSync(path.join(repo, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "score-paused-board", keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(repo, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { componentName: "StatusBoard", file: "src/screens/StatusBoard.tsx", title: "Score Paused Board" },
      ]));
      fs.writeFileSync(path.join(repo, "src/screens/StatusBoard.tsx"), "export function StatusBoard() { return <main>Paused score</main>; }\n");
      fs.writeFileSync(path.join(repo, "src/App.tsx"), "import { StatusBoard } from './screens/StatusBoard'; export default function App() { return <StatusBoard />; }\n");

      const feedback = [
        "BROWSER_GAME_RUNTIME_LOOP_MISSING: browser-game projects must wire a visible runtime loop with setInterval/requestAnimationFrame.",
        "ALSO_FIX:",
        "Keep this non-game issue.",
      ].join("\n");
      const output = sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo, workdir: repo });

      assert.doesNotMatch(output, /BROWSER_GAME_RUNTIME_LOOP_MISSING/);
      assert.match(output, /Keep this non-game issue/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("keeps browser-game runtime feedback when current source still reproduces it", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-runtime-active-"));
    try {
      fs.mkdirSync(path.join(repo, ".setfarm", "ledger"), { recursive: true });
      fs.mkdirSync(path.join(repo, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".setfarm", "ledger", "stack-contract.json"), JSON.stringify({ packId: "browser-game-canvas" }));
      fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "tiny-browser-game", keywords: ["browser-game"] }));
      fs.writeFileSync(path.join(repo, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { componentName: "GameplayScreen", file: "src/screens/GameplayScreen.tsx", title: "Gameplay" },
      ]));
      fs.writeFileSync(path.join(repo, "src/screens/GameplayScreen.tsx"), [
        "export function GameplayScreen({ runtime, actions }: any) {",
        "  return <main><button onClick={actions.advance}>Advance</button><span>{runtime.score}</span></main>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(repo, "src/App.tsx"), [
        "import { GameplayScreen } from './screens/GameplayScreen';",
        "export default function App() {",
        "  return <GameplayScreen runtime={{ score: 0 }} actions={{ advance() {} }} />;",
        "}",
      ].join("\n"));

      const feedback = "BROWSER_GAME_RUNTIME_LOOP_MISSING: browser-game projects must wire a visible runtime loop with setInterval/requestAnimationFrame and a scheduled tick/advance/step/update action.";
      const output = sanitizeRetryFeedbackForCurrentSource(feedback, { repoPath: repo, workdir: repo });
      assert.match(output, /BROWSER_GAME_RUNTIME_LOOP_MISSING/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("drops stale settings-flow smoke feedback when settings are explicitly out of scope", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-settings-flow-"));
    try {
      fs.mkdirSync(path.join(repo, ".setfarm"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".setfarm", "RUN_CONTRACT.json"), JSON.stringify({
        task: "Build a tiny status board. Do not add navigation, auth, analytics, settings, or unrelated modules.",
      }));
      const feedback = [
        "SYSTEM_SMOKE_FAILURE:",
        "VERIFY_SYSTEM_SMOKE_FAILURE for US-002:",
        "[FLOW] flow-no-visible-result: Settings expected settings flow; route/hash/text/form state did not confirm it",
        "ALSO_FIX:",
        "RETRY_WORKTREE_PATCH: omitted from retry feedback because raw diffs are not safe claim context.",
      ].join("\n");

      const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-retry-feedback-settings-workdir-"));
      const output = sanitizeRetryFeedbackForCurrentSource(feedback, {
        repoPath: workdir,
        workdir,
        contractRepoPath: repo,
      });
      assert.doesNotMatch(output, /Settings expected settings flow/);
      assert.match(output, /RETRY_WORKTREE_PATCH/);
      fs.rmSync(workdir, { recursive: true, force: true });
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
