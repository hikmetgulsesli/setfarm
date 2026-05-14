import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  buildClaimSummary,
  buildResolvedClaimBootstrapScript,
  buildPreclaimedPrompt,
} from "../dist/spawner-prompt.js";

describe("spawner prompt bootstrap", () => {
  it("emits a copy-safe first exec command instead of an inline jq shell blob", () => {
    const prompt = buildPreclaimedPrompt({
      wfId: "feature-dev",
      role: "developer",
      claimFile: "/tmp/claim-feature-dev_developer-spawner-test.json",
      claimSummaryFile: "/tmp/claim-summary-feature-dev_developer-spawner-test.json",
      outputFile: "/tmp/setfarm-output-feature-dev_developer-spawner-test.txt",
      bootstrapFile: "/tmp/setfarm-claim-bootstrap-feature-dev_developer-spawner-test.sh",
    });

    assert.match(prompt, /First exec command:\nbash '\/tmp\/setfarm-claim-bootstrap-feature-dev_developer-spawner-test\.sh'/);
    assert.match(prompt, /CLAIM_SUMMARY_FILE=\/tmp\/claim-summary-feature-dev_developer-spawner-test\.json/);
    assert.match(prompt, /Read the structured claim summary at \/tmp\/claim-summary-feature-dev_developer-spawner-test\.json first/);
    assert.match(prompt, /gitPolicy/);
    assert.match(prompt, /Setfarm performs the scoped commit and PR handoff after gates pass/);
    assert.match(prompt, /designContracts\.screenIndex, designContracts\.uiContract, designContracts\.componentRegistry, and designContracts\.componentTypes/);
    assert.match(prompt, /src\/_probe\.tsx, src\/probe\.tsx, tmp\.ts, scratch\.tsx/);
    assert.match(prompt, /Do NOT parse or dump claim\.input with jq\/sed\/head\/node loops/);
    assert.match(prompt, /Do NOT create scratch\/progress\/todo\/note\/probe files inside WORKDIR/);
    assert.doesNotMatch(prompt, /First exec command should start with/);
    assert.doesNotMatch(prompt, /jq -r/);
    assert.doesNotMatch(prompt, /case "\$WORKDIR" in/);
    assert.match(prompt, /step complete "\$STEP_ID" --file '\/tmp\/setfarm-output-feature-dev_developer-spawner-test\.txt'/);
  });

  it("bootstrap script resolves workdir and step id without shell syntax hazards", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-bootstrap-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      const claimFile = path.join(tmp, "claim.json");
      const claimSummaryFile = path.join(tmp, "claim-summary.json");
      const outputFile = path.join(tmp, "output.txt");
      const bootstrapFile = path.join(tmp, "bootstrap.sh");
      fs.writeFileSync(claimFile, JSON.stringify({
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        input: {
          task: "Project: bootstrap sensor",
          story_title: "Bootstrap story",
        },
      }) + "\n");
      fs.writeFileSync(claimSummaryFile, JSON.stringify({
        storyId: "US-001",
        storyTitle: "Bootstrap story",
        task: "Project: bootstrap sensor",
        scopeFiles: ["src/App.tsx"],
        gitPolicy: {
          owner: "setfarm-platform",
          summary: "Developer story agents write code only.",
          forbiddenForAgent: ["git add", "git commit", "git push"],
        },
        generatedScreenPolicy: {
          summary: "No generated screen source file is in scope.",
        },
        designContracts: {
          screenIndex: [{ componentName: "MainMenu" }],
          uiContract: [{ screenTitle: "Main Menu" }],
          componentRegistry: "export { MainMenu } from './MainMenu';",
          componentTypes: [{ file: "src/screens/MainMenu.tsx" }],
        },
        supervisorMemory: "### runtime guard\n- Summary: previous worker touched out-of-scope files",
      }) + "\n");
      fs.writeFileSync(bootstrapFile, buildResolvedClaimBootstrapScript({
        claimFile,
        claimSummaryFile,
        outputFile,
        stepId: "step-123",
        workdir,
        taskPreview: "Project: bootstrap sensor",
      }), { mode: 0o700 });

      const out = execFileSync("bash", [bootstrapFile], {
        encoding: "utf-8",
        timeout: 10_000,
      });

      assert.match(out, /STEP_ID=step-123/);
      assert.match(out, new RegExp(`WORKDIR=${workdir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.match(out, new RegExp(`CLAIM_SUMMARY_FILE=${claimSummaryFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.match(out, /STORY=US-001 Bootstrap story/);
      assert.match(out, /SCOPE_FILES=src\/App\.tsx/);
      assert.match(out, /GIT_POLICY=Developer story agents write code only/);
      assert.match(out, /FORBIDDEN_GIT=git add, git commit, git push/);
      assert.match(out, /GENERATED_SCREEN_POLICY=No generated screen source file is in scope/);
      assert.match(out, /SCREEN_INDEX_CONTRACTS=1/);
      assert.match(out, /UI_CONTRACTS=1/);
      assert.match(out, /COMPONENT_REGISTRY=present \d+ chars/);
      assert.match(out, /COMPONENT_TYPE_CONTRACTS=1/);
      assert.match(out, /SUPERVISOR_MEMORY=present \d+ chars/);
      assert.match(out, /Project: bootstrap sensor/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });


  it("extracts scope files from module prompt when the sidecar file is unavailable", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-fallback-"));
    try {
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir: tmp,
        repo: tmp,
        storyId: "US-001",
        input: [
          "# Developer Task",
          "",
          "## YOUR FILES (scope_files) — you may ONLY create/modify these:",
          "src/App.tsx, src/App.css, src/main.tsx, src/index.css",
          "",
          "SCOPE ENFORCEMENT: You may ONLY write files in [src/App.tsx, src/App.css, src/main.tsx, src/index.css].",
          "",
          "## Current Story",
          "Story US-001: Bootstrap story",
        ].join("\n"),
      });

      assert.deepEqual(summary.scopeFiles, ["src/App.tsx", "src/App.css", "src/main.tsx", "src/index.css"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("builds a compact structured claim summary so agents do not parse claim.input", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(path.join(workdir, "src", "screens"), { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/App.tsx\nsrc/state.ts\n");
      fs.writeFileSync(path.join(workdir, "SUPERVISOR_MEMORY.md"), "# Supervisor Memory\n\n### implement runtime-guard\n- Summary: worker read forbidden generated screens\n");
      fs.writeFileSync(path.join(workdir, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([
        { file: "src/screens/MainMenu.tsx", componentName: "MainMenu", actions: [{ id: "start-game-1", label: "START GAME" }] },
        { file: "src/screens/GameBoard.tsx", componentName: "GameBoard", actions: [{ id: "drop-1", label: "Drop" }] },
      ]));
      fs.writeFileSync(path.join(workdir, "src", "screens", "index.ts"), [
        "export { MainMenu } from './MainMenu';",
        "export { GameBoard } from './GameBoard';",
      ].join("\n"));
      fs.writeFileSync(path.join(workdir, "src", "screens", "MainMenu.tsx"), [
        "export type MainMenuActionId = \"start-game-1\";",
        "export interface MainMenuProps {",
        "  actions?: Partial<Record<MainMenuActionId, () => void>>;",
        "}",
        "export function MainMenu({ actions }: MainMenuProps) { return null; }",
      ].join("\n"));
      fs.writeFileSync(path.join(workdir, "src", "screens", "GameBoard.tsx"), [
        "export type GameBoardActionId = \"drop-1\";",
        "export interface GameBoardProps {",
        "  actions?: Partial<Record<GameBoardActionId, () => void>>;",
        "}",
        "export function GameBoard({ actions }: GameBoardProps) { return null; }",
      ].join("\n"));
      fs.mkdirSync(path.join(workdir, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(workdir, "stitch", "UI_CONTRACT.json"), JSON.stringify([
        {
          screenId: "main-menu",
          screenTitle: "Main Menu",
          deviceType: "DESKTOP",
          buttons: [{ label: "START GAME" }],
          inputs: [],
          navigation: [],
          totalInteractive: 1,
          requiresRouter: false,
        },
      ]));
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-001",
        input: [
          "TASK: Project: tetris sensor",
          `WORKDIR: ${workdir}`,
          "MAIN_REPO: /home/setrox/projects/tetris-sensor",
          "STORY_BRANCH: run-us-001",
          "BUILD_CMD: ",
          "TEST_CMD: ",
          "LINT_CMD: ",
          "",
          "*** GENERATED SCREEN CONTRACT ***",
          "CURRENT STORY: Story US-001: Tetris engine",
          "",
          "Acceptance Criteria:",
          "  1. Pieces fall and rotate.",
          "SCOPE: SCOPE ENFORCEMENT: You may ONLY write files in [src/App.tsx].",
          "STORY_SCREENS: []",
        ].join("\n"),
      });

      assert.equal(summary.schema, "setfarm.claim-summary.v1");
      assert.equal(summary.storyId, "US-001");
      assert.equal(summary.storyTitle, "Tetris engine");
      assert.equal(summary.buildCommand, "true");
      assert.equal(summary.testCommand, "true");
      assert.equal(summary.lintCommand, "true");
      assert.equal((summary.gitPolicy as any).owner, "setfarm-platform");
      assert.match((summary.gitPolicy as any).summary, /Developer story agents write code only/);
      assert.deepEqual((summary.gitPolicy as any).forbiddenForAgent.slice(0, 3), ["git add", "git commit", "git push"]);
      assert.deepEqual(summary.scopeFiles, ["src/App.tsx", "src/state.ts"]);
      assert.deepEqual((summary.generatedScreenPolicy as any).allowedSourceFiles, []);
      assert.deepEqual((summary.generatedScreenPolicy as any).forbiddenSourceFiles, [
        "src/screens/GameBoard.tsx",
        "src/screens/MainMenu.tsx",
      ]);
      assert.match((summary.generatedScreenPolicy as any).summary, /No generated screen source file is in scope/);
      assert.equal((summary.designContracts as any).screenIndex.length, 2);
      assert.equal((summary.designContracts as any).uiContract.length, 1);
      assert.match(JSON.stringify((summary.designContracts as any).screenIndex), /START GAME/);
      assert.match(String((summary.designContracts as any).componentRegistry), /export \{ MainMenu \}/);
      assert.equal((summary.designContracts as any).componentTypes.length, 2);
      assert.match(JSON.stringify((summary.designContracts as any).componentTypes), /MainMenuProps/);
      assert.match(JSON.stringify((summary.designContracts as any).componentTypes), /MainMenuActionId.*start-game-1/);
      assert.match(String((summary.designContracts as any).source), /instead of reading raw stitch\/\*\.html/);
      assert.match(String((summary.designContracts as any).source), /creating source-tree probe files/);
      assert.match(String(summary.supervisorMemory), /forbidden generated screens/);
      assert.match(String(summary.acceptanceCriteria), /Pieces fall and rotate/);
      assert.match(JSON.stringify(summary.handoff), /Audit fallback only/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not treat the next label as an empty command value", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-empty-cmd-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
        scripts: {
          build: "tsc && vite build",
          test: "vitest run",
        },
      }));
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "run-123",
        workdir: tmp,
        repo: tmp,
        input: [
          "TASK: Project: command parse sensor",
          `WORKDIR: ${tmp}`,
          "BUILD_CMD: ",
          "TEST_CMD: ",
          "LINT_CMD: ",
          "",
          "*** GENERATED SCREEN CONTRACT ***",
          "CURRENT STORY: Story US-001: command parsing",
          "Acceptance Criteria:",
          "  1. Empty command labels are not parsed as the following label.",
        ].join("\n"),
      });

      assert.equal(summary.buildCommand, "npm run build");
      assert.equal(summary.testCommand, "npm run test");
      assert.equal(summary.lintCommand, "true");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
