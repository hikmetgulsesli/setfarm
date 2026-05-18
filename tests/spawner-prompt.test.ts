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
    assert.match(prompt, /outputContract\.requiredFields and outputContract\.format exactly/);
    assert.match(prompt, /guard-backed roles will reject prose-only summaries/);
    assert.match(prompt, /Use retryFeedback\.mode exactly/);
    assert.match(prompt, /supervisorEvidence/);
    assert.match(prompt, /current-source scanner evidence/);
    assert.match(prompt, /mode="fix" means the blocker is an open implementation requirement/);
    assert.match(prompt, /mode="audit" means prior feedback may be stale/);
    assert.match(prompt, /gitPolicy/);
    assert.match(prompt, /Setfarm performs the scoped commit and PR handoff after gates pass/);
    assert.match(prompt, /designContracts\.screenIndex, designContracts\.uiContract, designContracts\.componentRegistry, and designContracts\.componentTypes/);
    assert.match(prompt, /Do NOT print or dump the entire claim summary JSON/);
    assert.match(prompt, /retryDiscipline\.mode/);
    assert.match(prompt, /retryDiscipline\.mode="first-delta"/);
    assert.match(prompt, /retryDiscipline\.mode="semantic-fix"/);
    assert.match(prompt, /make a small scoped source delta before broad analysis\/build\/test/);
    assert.match(prompt, /src\/_probe\.tsx, src\/probe\.tsx, tmp\.ts, scratch\.tsx/);
    assert.match(prompt, /Do NOT parse or dump claim\.input with jq\/sed\/head\/node loops/);
    assert.match(prompt, /Do NOT create scratch\/progress\/todo\/note\/probe files inside WORKDIR/);
    assert.doesNotMatch(prompt, /First exec command should start with/);
    assert.doesNotMatch(prompt, /jq -r/);
    assert.doesNotMatch(prompt, /case "\$WORKDIR" in/);
    assert.doesNotMatch(prompt, /\/usr\/bin\/node/);
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
        storyBranch: "run-us-001",
        repo: "/home/setrox/projects/bootstrap-sensor",
        mainRepo: "/home/setrox/projects/bootstrap-sensor",
        storyWorkdir: "/home/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees/run-us-001",
        verifyWorkdir: "/home/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees/run-us-001",
        task: "Project: bootstrap sensor",
        taskBrief: "Project: bootstrap sensor",
        outputContract: {
          format: [
            "STATUS: done|retry|skip|fail",
            "QA_REPORT: quality-reports/qa-test-1.md",
            "QA_SCREENS_TESTED: <number>",
          ].join("\n"),
          requiredFields: ["STATUS", "QA_REPORT", "QA_SCREENS_TESTED"],
        },
        buildCommand: "npm run build",
        testCommand: "npm run test:run",
        lintCommand: "true",
        scopeFiles: ["src/App.tsx"],
        gitPolicy: {
          owner: "setfarm-platform",
          summary: "Developer story agents write code only.",
          forbiddenForAgent: ["git add", "git commit", "git push"],
        },
        generatedScreenPolicy: {
          summary: "No generated screen source file is in scope.",
        },
        screenUsageContract: {
          summary: "Use compact screen contract first.",
          components: [
            {
              componentName: "MainMenu",
              file: "src/screens/MainMenu.tsx",
              sourceRead: "forbidden",
              actionIds: ["start-game-1", "settings-4"],
            },
          ],
        },
        designContracts: {
          screenIndex: [{ componentName: "MainMenu" }],
          uiContract: [{ screenTitle: "Main Menu" }],
          componentRegistry: "export { MainMenu } from './MainMenu';",
          componentTypes: [{ file: "src/screens/MainMenu.tsx" }],
        },
        supervisorMemory: "### runtime guard\n- Summary: previous worker touched out-of-scope files",
        previousFailure: "GENERATED_SCREEN_SHARED_READ: previous worker read src/screens/MainMenu.tsx",
        failureCategory: "GENERATED_SCREEN_SHARED_READ",
        failureSuggestion: "Use claim-summary designContracts instead of shared generated source.",
        scopeFileStates: [
          {
            path: "src/App.tsx",
            exists: false,
            kind: "missing",
            instruction: "Create this owned file directly if the story requires it; do not treat the missing file as a blocker.",
          },
        ],
        existingScopeFiles: [],
        missingScopeFiles: ["src/App.tsx"],
        scopeFileInstruction: "scopeFiles is the owned write set for this story. Missing scope files are expected new owned files; create them directly with add-file/create-file semantics when needed instead of retrying update-only patches.",
        retryDiscipline: {
          mode: "first-delta",
          instruction: "Hard manager retry discipline: inspect owned scope files and make a small scoped source delta before broad analysis.",
        },
        retryFeedback: {
          mode: "fix",
          category: "GENERATED_SCREEN_SHARED_READ",
          suggestion: "Use claim-summary designContracts instead of shared generated source.",
          blocker: "GENERATED_SCREEN_SHARED_READ: previous worker read src/screens/MainMenu.tsx",
          instruction: "Previous feedback is an open implementation blocker.",
        },
      }) + "\n");
      fs.writeFileSync(bootstrapFile, buildResolvedClaimBootstrapScript({
        claimFile,
        claimSummaryFile,
        outputFile,
        stepId: "step-123",
        workdir,
        taskPreview: "TASK:\nProject: bootstrap sensor\nTEST_CMD: true",
      }), { mode: 0o700 });

      const out = execFileSync("bash", [bootstrapFile], {
        encoding: "utf-8",
        timeout: 10_000,
      });

      assert.match(out, /STEP_ID=step-123/);
      assert.match(out, new RegExp(`WORKDIR=${workdir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.match(out, new RegExp(`CLAIM_SUMMARY_FILE=${claimSummaryFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.match(out, /STORY=US-001 Bootstrap story/);
      assert.match(out, /STORY_BRANCH=run-us-001/);
      assert.match(out, /STORY_WORKDIR=\/home\/setrox\/\.openclaw\/workspaces\/workflows\/feature-dev\/agents\/developer\/story-worktrees\/run-us-001/);
      assert.match(out, /VERIFY_WORKDIR=\/home\/setrox\/\.openclaw\/workspaces\/workflows\/feature-dev\/agents\/developer\/story-worktrees\/run-us-001/);
      assert.match(out, /MAIN_REPO=\/home\/setrox\/projects\/bootstrap-sensor/);
      assert.match(out, /BUILD_CMD=npm run build/);
      assert.match(out, /TEST_CMD=npm run test:run/);
      assert.match(out, /LINT_CMD=true/);
      assert.match(out, /SCOPE_FILES=src\/App\.tsx/);
      assert.match(out, /MISSING_SCOPE_FILES=src\/App\.tsx/);
      assert.match(out, /SCOPE_FILE_POLICY=.*Missing scope files are expected new owned files/);
      assert.match(out, /GIT_POLICY=Developer story agents write code only/);
      assert.match(out, /FORBIDDEN_GIT=git add, git commit, git push/);
      assert.match(out, /SCREEN_USAGE=Use compact screen contract first/);
      assert.match(out, /SCREEN_COMPONENT=MainMenu src\/screens\/MainMenu\.tsx forbidden actions=start-game-1\|settings-4/);
      assert.match(out, /FAILURE_CATEGORY=GENERATED_SCREEN_SHARED_READ/);
      assert.match(out, /FAILURE_SUGGESTION=Use claim-summary designContracts instead of shared generated source/);
      assert.match(out, /RETRY_MODE=fix/);
      assert.match(out, /RETRY_BLOCKER=GENERATED_SCREEN_SHARED_READ: previous worker read src\/screens\/MainMenu\.tsx/);
      assert.match(out, /RETRY_ACTION=Use claim-summary designContracts instead of shared generated source/);
      assert.match(out, /RETRY_INSTRUCTION=Previous feedback is an open implementation blocker/);
      assert.match(out, /RETRY_DISCIPLINE=first-delta: Hard manager retry discipline/);
      assert.match(out, /PREVIOUS_FAILURE=present \d+ chars/);
      assert.match(out, /GENERATED_SCREEN_POLICY=No generated screen source file is in scope/);
      assert.match(out, /SCREEN_INDEX_CONTRACTS=1/);
      assert.match(out, /UI_CONTRACTS=1/);
      assert.match(out, /COMPONENT_REGISTRY=present \d+ chars/);
      assert.match(out, /COMPONENT_TYPE_CONTRACTS=1/);
      assert.match(out, /SUPERVISOR_MEMORY=present \d+ chars/);
      assert.match(out, /TASK_BRIEF=Project: bootstrap sensor/);
      assert.match(out, /OUTPUT_REQUIRED_FIELDS=STATUS, QA_REPORT, QA_SCREENS_TESTED/);
      assert.match(out, /OUTPUT_CONTRACT STATUS: done\|retry\|skip\|fail/);
      assert.match(out, /OUTPUT_CONTRACT QA_REPORT: quality-reports\/qa-test-1\.md/);
      assert.doesNotMatch(out, /TEST_CMD: true/);
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
      assert.deepEqual(summary.existingScopeFiles, []);
      assert.deepEqual(summary.missingScopeFiles, ["src/App.tsx", "src/App.css", "src/main.tsx", "src/index.css"]);
      assert.match(String(summary.scopeFileInstruction), /Missing scope files are expected new owned files/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("marks existing and missing scope files separately for worker patch mode", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-scope-state-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src", "App.tsx"), "export function App() { return null; }\n");
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\nsrc/App.css\nsrc/contexts/AppContext.tsx\n");

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
          "CURRENT STORY: Story US-001: Bootstrap story",
        ].join("\n"),
      });

      assert.deepEqual(summary.scopeFiles, ["src/App.tsx", "src/App.css", "src/contexts/AppContext.tsx"]);
      assert.deepEqual(summary.existingScopeFiles, ["src/App.tsx"]);
      assert.deepEqual(summary.missingScopeFiles, ["src/App.css", "src/contexts/AppContext.tsx"]);
      assert.deepEqual(
        (summary.scopeFileStates as any[]).map((file) => [file.path, file.kind, file.exists]),
        [
          ["src/App.tsx", "existing", true],
          ["src/App.css", "missing", false],
          ["src/contexts/AppContext.tsx", "missing", false],
        ],
      );
      assert.match(String(summary.scopeFileInstruction), /create them directly with add-file\/create-file semantics/);
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
      const supervisorDir = path.join(workdir, ".setfarm", "supervisor", "run-123");
      fs.mkdirSync(supervisorDir, { recursive: true });
      fs.writeFileSync(path.join(supervisorDir, "SUPERVISOR_STATE.json"), JSON.stringify({
        schema: "setfarm.supervisor-state.v1",
        runId: "run-123",
        projectStatus: "implementing",
        updatedAt: "2026-05-17T00:00:00.000Z",
        stories: {
          "US-001": {
            status: "passed",
            currentWorker: "feature-dev_developer",
            openBlockers: [],
            warnings: [],
            resolved: ["dom:main-menu:start"],
            lastEvidenceAt: "2026-05-17T00:00:00.000Z",
          },
        },
        evidence: {
          "dom:main-menu:start": {
            itemId: "dom:main-menu:start",
            storyId: "US-001",
            status: "passed",
            severity: "blocker",
            observed: ["START GAME"],
            lastScan: "static-control-scan",
            files: ["src/screens/MainMenu.tsx"],
            line: 1,
            message: "SUPERVISOR_CHECKLIST button \"START GAME\" passed scanner evidence",
            checkedAt: "2026-05-17T00:00:00.000Z",
          },
        },
        interventions: [],
      }, null, 2));
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
          "",
          "## Previous Failure / Retry Feedback",
          "Failure category: GENERATED_SCREEN_SHARED_READ",
          "Suggested response: Use claim-summary designContracts instead.",
          "",
          "GENERATED_SCREEN_SHARED_READ: previous worker read src/screens/MainMenu.tsx",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.schema, "setfarm.claim-summary.v1");
      assert.equal(summary.storyId, "US-001");
      assert.equal(summary.storyTitle, "Tetris engine");
      assert.equal(summary.storyBranch, "run-us-001");
      assert.equal(summary.repo, "/home/setrox/projects/tetris-sensor");
      assert.equal(summary.mainRepo, "/home/setrox/projects/tetris-sensor");
      assert.equal(summary.storyWorkdir, "");
      assert.equal(summary.verifyWorkdir, workdir);
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
      assert.match((summary.screenUsageContract as any).summary, /Use this compact contract before designContracts/);
      assert.match((summary.screenUsageContract as any).sourceReadRule, /supervisor signals/);
      assert.equal((summary.screenUsageContract as any).importFrom, "src/screens");
      assert.deepEqual(
        (summary.screenUsageContract as any).components.map((c: any) => [c.componentName, c.file, c.sourceRead]),
        [
          ["GameBoard", "src/screens/GameBoard.tsx", "forbidden"],
          ["MainMenu", "src/screens/MainMenu.tsx", "forbidden"],
        ],
      );
      assert.deepEqual((summary.screenUsageContract as any).components[1].actionIds, ["start-game-1"]);
      assert.match((summary.generatedScreenPolicy as any).summary, /No generated screen source file is in scope/);
      assert.match((summary.generatedScreenPolicy as any).summary, /OpenClaw read tool/);
      assert.match((summary.generatedScreenPolicy as any).summary, /component registry/);
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
      assert.equal((summary.supervisorEvidence as any).storyStatus, "passed");
      assert.equal((summary.supervisorEvidence as any).counts.blockers, 0);
      assert.equal((summary.supervisorEvidence as any).counts.resolved, 1);
      assert.match(String((summary.supervisorEvidence as any).instruction), /Current-source scanner evidence/);
      assert.match(String(summary.previousFailure), /GENERATED_SCREEN_SHARED_READ/);
      assert.equal(summary.failureCategory, "GENERATED_SCREEN_SHARED_READ");
      assert.equal(summary.failureSuggestion, "Use claim-summary designContracts instead.");
      assert.equal((summary.retryFeedback as any).mode, "fix");
      assert.equal((summary.retryDiscipline as any).mode, "first-delta");
      assert.match((summary.retryFeedback as any).blocker, /GENERATED_SCREEN_SHARED_READ/);
      assert.match((summary.retryFeedback as any).suggestion, /claim-summary designContracts/);
      assert.match((summary.retryFeedback as any).instruction, /open implementation blocker/);
      assert.match(String((summary.retryDiscipline as any).instruction), /small scoped source delta/);
      assert.match(String(summary.acceptanceCriteria), /Pieces fall and rotate/);
      assert.match(String(summary.currentStory), /Story US-001: Tetris engine/);
      assert.match(JSON.stringify(summary.handoff), /Audit fallback only/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("derives single-step project roots from claim context and keeps task text compact", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-single-step-summary-"));
    try {
      const repo = path.join(tmp, "orbit-blocks-canary");
      const scratch = path.join(tmp, "agent-scratch");
      fs.mkdirSync(repo, { recursive: true });
      fs.mkdirSync(scratch, { recursive: true });
      const noisyStories = JSON.stringify([
        {
          id: "US-001",
          title: "Generated screen and controller wiring",
          acceptanceCriteria: new Array(20).fill("Every visible control must be interactive."),
        },
      ], null, 2);

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "qa-tester",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-qa",
        runId: "run-qa",
        workdir: scratch,
        repo: scratch,
        input: [
          "# QA Test Step - Browser, Visual, and Functional Test Agent",
          "",
          "Test the project after verify and security-gate. Open the live app in a browser,",
          "prove that acceptance criteria work at runtime, traverse routes and controls,",
          "capture screenshots, and write one batch QA report.",
          "",
          "## Context",
          "",
          `- ${repo}: project root`,
          "- run-qa: feature branch",
          `- ${noisyStories}: stories payload`,
          "",
          "## Output Format",
          "",
          "```",
          "STATUS: done|retry|skip|fail",
          "QA_REPORT: quality-reports/qa-test-1.md",
          "QA_SCREENS_TESTED: <number>",
          "QA_ROUTES_TESTED: <number>",
          "QA_INTERACTIONS_TESTED: <number>",
          "QA_TOTAL_ISSUES: <number>",
          "TEST_FAILURES: <batch issue list when STATUS is retry>",
          "ISSUES: <optional extra observations>",
          "```",
        ].join("\n"),
      });

      assert.equal(summary.workdir, repo);
      assert.equal(summary.verifyWorkdir, repo);
      assert.equal(summary.repo, repo);
      assert.equal(summary.mainRepo, repo);
      assert.match(String(summary.task), /^Test the project after verify and security-gate/);
      assert.ok(String(summary.task).length <= 700);
      assert.doesNotMatch(String(summary.task), /acceptanceCriteria|US-001|stories payload/);
      assert.deepEqual((summary.outputContract as any).requiredFields, [
        "STATUS",
        "QA_REPORT",
        "QA_SCREENS_TESTED",
        "QA_ROUTES_TESTED",
        "QA_INTERACTIONS_TESTED",
        "QA_TOTAL_ISSUES",
        "TEST_FAILURES",
        "ISSUES",
      ]);
      assert.match(String((summary.outputContract as any).format), /QA_TOTAL_ISSUES: <number>/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("loads current supervisor evidence from sibling story worktrees", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-sibling-supervisor-evidence-"));
    try {
      const agentsRoot = path.join(tmp, "workflows", "feature-dev", "agents");
      const storyBranch = "run-us-001";
      const supervisorWorkdir = path.join(agentsRoot, "supervisor", "story-worktrees", storyBranch);
      const developerWorkdir = path.join(agentsRoot, "developer", "story-worktrees", storyBranch);
      fs.mkdirSync(supervisorWorkdir, { recursive: true });
      fs.mkdirSync(developerWorkdir, { recursive: true });
      const emptySupervisorStateDir = path.join(supervisorWorkdir, ".setfarm", "supervisor", "run-123");
      fs.mkdirSync(emptySupervisorStateDir, { recursive: true });
      fs.writeFileSync(path.join(emptySupervisorStateDir, "SUPERVISOR_STATE.json"), JSON.stringify({
        schema: "setfarm.supervisor-state.v1",
        runId: "run-123",
        projectStatus: "implementing",
        updatedAt: "2026-05-17T00:05:00.000Z",
        stories: {},
        evidence: {},
        interventions: [],
      }, null, 2));
      const stateDir = path.join(developerWorkdir, ".setfarm", "supervisor", "run-123");
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(path.join(stateDir, "SUPERVISOR_STATE.json"), JSON.stringify({
        schema: "setfarm.supervisor-state.v1",
        runId: "run-123",
        projectStatus: "implementing",
        updatedAt: "2026-05-17T00:00:00.000Z",
        stories: {
          "US-001": {
            status: "passed",
            openBlockers: [],
            warnings: [],
            resolved: ["dom:screen:start"],
            lastEvidenceAt: "2026-05-17T00:00:00.000Z",
          },
        },
        evidence: {
          "dom:screen:start": {
            itemId: "dom:screen:start",
            storyId: "US-001",
            status: "passed",
            severity: "blocker",
            observed: ["Start"],
            lastScan: "static-control-scan",
            files: ["src/screens/MainMenu.tsx"],
            message: "passed current scanner evidence",
            checkedAt: "2026-05-17T00:00:00.000Z",
          },
        },
        interventions: [],
      }, null, 2));

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "supervisor",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "run-123",
        workdir: supervisorWorkdir,
        repo: supervisorWorkdir,
        storyId: "US-001",
        input: [
          "TASK: sibling evidence",
          `WORKDIR: ${supervisorWorkdir}`,
          `STORY_BRANCH: ${storyBranch}`,
          "CURRENT STORY: Story US-001: Main Menu",
        ].join("\n"),
      });

      assert.equal((summary.supervisorEvidence as any).storyStatus, "passed");
      assert.match(String((summary.supervisorEvidence as any).workdir), /developer\/story-worktrees\/run-us-001$/);
      assert.equal((summary.supervisorEvidence as any).counts.blockers, 0);
      assert.equal((summary.supervisorEvidence as any).counts.passed, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("bootstrap prefers claim-summary workdir over stale scratch workdir", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-workdir-bootstrap-"));
    try {
      const repo = path.join(tmp, "project");
      const scratch = path.join(tmp, "agent-scratch");
      fs.mkdirSync(repo, { recursive: true });
      fs.mkdirSync(scratch, { recursive: true });
      const claimFile = path.join(tmp, "claim.json");
      const claimSummaryFile = path.join(tmp, "claim-summary.json");
      const outputFile = path.join(tmp, "output.txt");
      const bootstrapFile = path.join(tmp, "bootstrap.sh");
      fs.writeFileSync(claimFile, JSON.stringify({
        stepId: "step-qa",
        runId: "run-qa",
        workdir: scratch,
        repo: scratch,
      }) + "\n");
      fs.writeFileSync(claimSummaryFile, JSON.stringify({
        workdir: repo,
        repo,
        mainRepo: repo,
        taskBrief: "QA project root sensor",
      }) + "\n");
      fs.writeFileSync(bootstrapFile, buildResolvedClaimBootstrapScript({
        claimFile,
        claimSummaryFile,
        outputFile,
        stepId: "step-qa",
        workdir: scratch,
        taskPreview: "QA project root sensor",
      }), { mode: 0o700 });

      const out = execFileSync("bash", [bootstrapFile], {
        encoding: "utf-8",
        timeout: 10_000,
      });

      assert.match(out, new RegExp(`WORKDIR=${repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.match(out, new RegExp(`MAIN_REPO=${repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.doesNotMatch(out, new RegExp(`WORKDIR=${scratch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("elevates raw runtime-bridge retry feedback into a semantic-fix manager instruction", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-runtime-bridge-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
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
        storyId: "US-001",
        input: [
          "TASK: Project: runtime bridge sensor",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: Runtime bridge",
          "",
          "Acceptance Criteria:",
          "  1. Shared state is visible through window.app.",
          "",
          "## Previous Failure / Retry Feedback",
          "RUNTIME_BRIDGE_MISSING: Story US-001 acceptance criteria require window.app, but no scoped source file assigns window.app/globalThis.app.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "RUNTIME_BRIDGE_MISSING");
      assert.match(String(summary.failureSuggestion), /window\.app = \{ state, actions \}|globalThis\.app = \{ state, actions \}/);
      assert.equal((summary.retryFeedback as any).mode, "fix");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /window\.app = \{ state, actions \}|globalThis\.app = \{ state, actions \}/);
      assert.match(String((summary.retryDiscipline as any).instruction), /Type declarations, comments, docs, window\.game/);
      assert.match((summary.retryFeedback as any).blocker, /RUNTIME_BRIDGE_MISSING/);
      assert.match((summary.retryFeedback as any).suggestion, /window\.app = \{ state, actions \}|globalThis\.app = \{ state, actions \}/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("elevates verifier retry findings into bounded quality-fix feedback", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-quality-retry-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\nsrc/test/utils.tsx\n");
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
        storyId: "US-001",
        input: [
          "TASK: Project: quality retry sensor",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "STATUS: retry",
          "FINDINGS:",
          "- src/App.tsx:270-280: rotateTile increments moves when no tile mutation occurs.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "QUALITY_RETRY_FEEDBACK");
      assert.equal((summary.retryFeedback as any).mode, "fix");
      assert.match((summary.retryFeedback as any).blocker, /rotateTile increments moves/);
      assert.match(String(summary.failureSuggestion), /exact retry findings/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("elevates missing scope files into a semantic-fix manager instruction", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-file-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\nsrc/hooks/useAppState.ts\n");
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
        storyId: "US-001",
        input: [
          "TASK: Project: scope file sensor",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "SCOPE_FILE_MISSING: Story US-001 declared scope_files=[\"src/App.tsx\",\"src/hooks/useAppState.ts\"] but only 1/2 exist as non-empty files.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "SCOPE_FILE_MISSING");
      assert.match(String(summary.failureSuggestion), /declared scope_files/);
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /declared scope_files/);
      assert.match(String((summary.retryDiscipline as any).instruction), /Do not collapse the implementation into one file/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("elevates DESIGN_DOM mismatches into semantic-fix manager discipline", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-dom-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/screens/MainMenu.tsx\nsrc/screens/GameBoard.tsx\n");
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
        storyId: "US-002",
        input: [
          "TASK: Project: Pong arcade",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-002: Main Menu and Game Board",
          "",
          "## Previous Failure / Retry Feedback",
          "SUPERVISOR_BLOCKERS_OPEN: Story US-002 has deterministic supervisor blockers.",
          "- src/screens/GameBoard.tsx: missing DESIGN_DOM button \"arrow_drop_up\" on Game Board",
          "- src/screens/MainMenu.tsx: static button \"Start New Game\" needs a real handler or explicit disabled state",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "SUPERVISOR_BLOCKERS_OPEN");
      assert.equal((summary.retryFeedback as any).mode, "fix");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /Supervisor checklist discipline/);
      assert.match(String((summary.retryDiscipline as any).instruction), /Missing controls, dead links, and static active controls/);
      assert.doesNotMatch(String((summary.retryDiscipline as any).instruction), /first edit/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not turn an empty previous-failure block into retry feedback", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-empty-previous-failure-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/screens/MainMenu.tsx\n");
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "9923bbd6-6541-4d3e-ad2a-8b2d15a8a22f",
        workdir: tmp,
        repo: tmp,
        storyId: "US-002",
        input: [
          "TASK: Project: Pong arcade",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-002: Main Menu",
          "",
          "## Previous Failure / Retry Feedback",
          "Failure category: ",
          "Suggested response: ",
          "",
          "## Claim Handoff",
          "RUN_ID: 9923bbd6-6541-4d3e-ad2a-8b2d15a8a22f",
          "STORY_ID: US-002",
          "STORY_BRANCH: 9923bbd6-us-002",
          `STORY_WORKDIR: ${tmp}`,
          "",
          "## Current Story",
          "Story US-002: Main Menu",
        ].join("\n"),
      });

      assert.equal(summary.previousFailure, "");
      assert.equal(summary.failureCategory, "");
      assert.equal(summary.failureSuggestion, "");
      assert.equal(summary.retryFeedback, undefined);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("hands prior retry feedback to supervisors as audit context, not an edit mandate", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-audit-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
        scripts: {
          build: "tsc && vite build",
          test: "vitest",
          "test:run": "vitest run",
        },
      }));
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "supervisor",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "run-123",
        workdir: tmp,
        repo: tmp,
        storyId: "US-001",
        input: [
          "TASK:",
          "Build a browser-based Breakout arcade game.",
          "BUILD_CMD: true",
          "TEST_CMD: true",
          "",
          "CURRENT_STORY: US-001 Breakout arcade - game engine",
          "",
          "## Previous Failure / Retry Feedback",
          "GENERATED_SCREEN_SHARED_READ: previous worker read src/screens/MainMenu.tsx",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal((summary.retryFeedback as any).mode, "audit");
      assert.equal(summary.retryDiscipline, undefined);
      assert.match((summary.retryFeedback as any).instruction, /prior review context/);
      assert.equal(summary.taskBrief, "Build a browser-based Breakout arcade game.");
      assert.equal(summary.buildCommand, "npm run build");
      assert.equal(summary.testCommand, "npm run test:run");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("extracts supervisor Output Contract blocks into claim summaries", () => {
    const summary = buildClaimSummary({
      wfId: "feature-dev",
      role: "supervisor",
      claimFile: "/tmp/claim.json",
      outputFile: "/tmp/output.txt",
      bootstrapFile: "/tmp/bootstrap.sh",
      stepId: "step-supervise",
      runId: "run-supervise",
      workdir: "/tmp",
      repo: "/tmp",
      storyId: "US-001",
      input: [
        "TASK:",
        "Build a browser game.",
        "",
        "CURRENT_STORY: US-001 Runtime bridge",
        "",
        "## Output Contract",
        "",
        "If clean:",
        "",
        "STATUS: done",
        "SUPERVISOR_DECISION: pass",
        "SUPERVISOR_MEMORY_APPEND: <checked>",
        "CHECKS: <commands>",
        "CHANGES: none",
        "RISKS: none",
      ].join("\n"),
    });

    assert.match(String((summary.outputContract as any)?.format), /SUPERVISOR_DECISION: pass/);
    assert.deepEqual((summary.outputContract as any)?.requiredFields.slice(0, 2), ["STATUS", "SUPERVISOR_DECISION"]);
  });

  it("extracts story acceptance criteria from story-scoped supervisor prompts", () => {
    const summary = buildClaimSummary({
      wfId: "feature-dev",
      role: "supervisor",
      claimFile: "/tmp/claim.json",
      outputFile: "/tmp/output.txt",
      bootstrapFile: "/tmp/bootstrap.sh",
      stepId: "step-supervise",
      runId: "run-supervise",
      workdir: "/tmp",
      repo: "/tmp",
      storyId: "US-001",
      input: [
        "SUPERVISOR_SCOPE: story",
        "CURRENT_STORY: Story US-001: Game runtime",
        "",
        "Build the runtime state bridge.",
        "",
        "Acceptance Criteria:",
        "  1. Expose storage status and last error through window.app.",
        "  2. Disable gameplay controls when the game is not playing.",
        "",
        "For `SUPERVISOR_SCOPE: story`, audit only this story.",
        "",
        "PREVIOUS FAILURE:",
        "(none)",
      ].join("\n"),
    });

    assert.match(String(summary.acceptanceCriteria), /Expose storage status and last error/);
    assert.match(String(summary.acceptanceCriteria), /Disable gameplay controls/);
    assert.doesNotMatch(String(summary.acceptanceCriteria), /PREVIOUS FAILURE/);
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

  it("uses the story worktree for verification while preserving the canonical main repo", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-story-workdir-"));
    try {
      const mainRepo = path.join(tmp, "main-repo");
      const storyWorkdir = path.join(tmp, "workflows", "feature-dev", "agents", "developer", "story-worktrees", "33d23f10-us-001");
      fs.mkdirSync(mainRepo, { recursive: true });
      fs.mkdirSync(storyWorkdir, { recursive: true });
      fs.writeFileSync(path.join(storyWorkdir, "package.json"), JSON.stringify({
        scripts: {
          build: "tsc && vite build",
          test: "vitest run",
        },
      }));

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "reviewer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "33d23f10-f68c-4c75-a9e9-4a48996d075b",
        workdir: storyWorkdir,
        repo: storyWorkdir,
        storyId: "US-001",
        input: [
          "TASK: Project: worktree routing sensor",
          `VERIFY_WORKDIR: ${storyWorkdir}`,
          `MAIN_REPO: ${mainRepo}`,
          `STORY_WORKDIR: ${storyWorkdir}`,
          `REPO: ${storyWorkdir}`,
          "STORY_BRANCH: 33d23f10-us-001",
          "",
          "CURRENT STORY: Story US-001: Worktree routing",
        ].join("\n"),
      });

      assert.equal(summary.workdir, storyWorkdir);
      assert.equal(summary.storyWorkdir, storyWorkdir);
      assert.equal(summary.verifyWorkdir, storyWorkdir);
      assert.equal(summary.repo, mainRepo);
      assert.equal(summary.mainRepo, mainRepo);
      assert.equal(summary.storyBranch, "33d23f10-us-001");
      assert.equal(summary.buildCommand, "npm run build");
      assert.equal(summary.testCommand, "npm run test");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("adds reviewer output contract defaults and command aliases when role prompt omits output format", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-reviewer-default-contract-"));
    try {
      const mainRepo = path.join(tmp, "main-repo");
      const storyWorkdir = path.join(tmp, "workflows", "feature-dev", "agents", "developer", "story-worktrees", "33d23f10-us-001");
      fs.mkdirSync(mainRepo, { recursive: true });
      fs.mkdirSync(storyWorkdir, { recursive: true });
      fs.writeFileSync(path.join(storyWorkdir, "package.json"), JSON.stringify({
        scripts: {
          build: "tsc && vite build",
          "test:run": "vitest run",
        },
      }));

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "reviewer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "33d23f10-f68c-4c75-a9e9-4a48996d075b",
        workdir: storyWorkdir,
        repo: storyWorkdir,
        storyId: "US-001",
        input: [
          "TASK: verify one story PR.",
          `VERIFY_WORKDIR: ${storyWorkdir}`,
          `MAIN_REPO: ${mainRepo}`,
          `STORY_WORKDIR: ${storyWorkdir}`,
          `REPO: ${storyWorkdir}`,
          "LINT_CMD: true",
          "STORY_BRANCH: 33d23f10-us-001",
          "",
          "CURRENT STORY: Story US-001: Runtime bridge",
          "",
          "## Feedback Format",
          "",
          "Use actionable findings.",
        ].join("\n"),
      });

      assert.equal((summary.outputContract as any).source, "role-default");
      assert.deepEqual((summary.outputContract as any).requiredFields, [
        "STATUS",
        "STORY",
        "ROLE",
        "RESULT",
        "FINDINGS",
        "CHECKS",
        "SCOPE",
      ]);
      assert.match(String((summary.outputContract as any).format), /STATUS: done\|retry\|fail/);
      assert.equal(summary.buildCommand, "npm run build");
      assert.equal(summary.testCommand, "npm run test:run");
      assert.equal(summary.lintCommand, "true");
      assert.equal(summary.buildCmd, "npm run build");
      assert.equal(summary.testCmd, "npm run test:run");
      assert.equal(summary.lintCmd, "true");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("falls back to the existing repo when a story worktree handoff is stale", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-stale-story-workdir-"));
    try {
      const mainRepo = path.join(tmp, "main-repo");
      const staleStoryWorkdir = path.join(tmp, "workflows", "feature-dev", "agents", "developer", "story-worktrees", "33d23f10-us-001");
      fs.mkdirSync(mainRepo, { recursive: true });
      fs.writeFileSync(path.join(mainRepo, "package.json"), JSON.stringify({
        scripts: {
          build: "tsc && vite build",
          test: "vitest",
          "test:run": "vitest run",
        },
      }));

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "reviewer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "33d23f10-f68c-4c75-a9e9-4a48996d075b",
        workdir: mainRepo,
        repo: mainRepo,
        storyId: "US-001",
        input: [
          "TASK: Project: stale worktree routing sensor",
          `VERIFY_WORKDIR: ${staleStoryWorkdir}`,
          `MAIN_REPO: ${mainRepo}`,
          `STORY_WORKDIR: ${staleStoryWorkdir}`,
          "BUILD_CMD: true",
          "TEST_CMD: true",
          "LINT_CMD: true",
          "STORY_BRANCH: 33d23f10-us-001",
          "",
          "CURRENT STORY: Story US-001: Worktree routing",
        ].join("\n"),
      });

      assert.equal(summary.workdir, mainRepo);
      assert.equal(summary.storyWorkdir, "");
      assert.equal(summary.verifyWorkdir, mainRepo);
      assert.equal(summary.repo, mainRepo);
      assert.equal(summary.mainRepo, mainRepo);
      assert.equal(summary.buildCommand, "npm run build");
      assert.equal(summary.testCommand, "npm run test:run");
      assert.equal(summary.lintCommand, "true");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("discovers a story-scoped supervisor worktree from CURRENT_STORY and run id", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-supervisor-story-workdir-"));
    const workflowId = `feature-dev-summary-test-${process.pid}-${Date.now()}`;
    const branch = "33d23f10-us-001";
    const workflowRoot = path.join(os.homedir(), ".openclaw", "workspaces", "workflows", workflowId);
    try {
      const mainRepo = path.join(tmp, "main-repo");
      const storyWorkdir = path.join(workflowRoot, "agents", "developer", "story-worktrees", branch);
      fs.mkdirSync(mainRepo, { recursive: true });
      fs.mkdirSync(storyWorkdir, { recursive: true });
      fs.writeFileSync(path.join(storyWorkdir, "package.json"), JSON.stringify({
        scripts: {
          build: "tsc && vite build",
          test: "vitest",
          "test:run": "vitest run",
        },
      }));

      const summary = buildClaimSummary({
        wfId: workflowId,
        role: "supervisor",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "33d23f10-f68c-4c75-a9e9-4a48996d075b",
        workdir: mainRepo,
        repo: mainRepo,
        input: [
          "TASK: Project: supervisor story routing sensor",
          `MAIN_REPO: ${mainRepo}`,
          `REPO: ${mainRepo}`,
          "BUILD_CMD: true",
          "TEST_CMD: true",
          "CURRENT_STORY: US-001 Breakout arcade - game engine, state and test bridge",
        ].join("\n"),
      });

      assert.equal(summary.storyId, "US-001");
      assert.equal(summary.storyTitle, "Breakout arcade - game engine, state and test bridge");
      assert.equal(summary.storyBranch, branch);
      assert.equal(summary.workdir, storyWorkdir);
      assert.equal(summary.storyWorkdir, storyWorkdir);
      assert.equal(summary.verifyWorkdir, storyWorkdir);
      assert.equal(summary.repo, mainRepo);
      assert.equal(summary.buildCommand, "npm run build");
      assert.equal(summary.testCommand, "npm run test:run");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(workflowRoot, { recursive: true, force: true });
    }
  });

  it("derives storyBranch from authoritative handoff instead of output-format placeholders", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-branch-"));
    try {
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "33d23f10-f68c-4c75-a9e9-4a48996d075b",
        workdir: tmp,
        repo: tmp,
        storyId: "US-001",
        input: [
          "TASK: Project: branch parse sensor",
          `WORKDIR: ${tmp}`,
          "MAIN_REPO: /home/setrox/projects/branch-parse-sensor",
          "",
          "1. **WORKING DIRECTORY AND BRANCH.**",
          "   - **Branch:** This story uses exactly `33d23f10-us-001`. The branch is already checked out.",
          "",
          "## Current Story",
          "Story US-001: Branch parse",
          "",
          "## Output Format",
          "```",
          "STATUS: done",
          "STORY_BRANCH: <your-branch-name>",
          "CHANGES: <summary>",
          "```",
        ].join("\n"),
      });

      assert.equal(summary.storyBranch, "33d23f10-us-001");
      assert.equal(summary.repo, "/home/setrox/projects/branch-parse-sensor");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
