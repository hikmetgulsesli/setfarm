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

    assert.match(prompt, /First exec command \(copy exactly; do not append redirection, pipes, head\/tail, tee, timeout, chaining, or any wrapper\):\nbash '\/tmp\/setfarm-claim-bootstrap-feature-dev_developer-spawner-test\.sh'/);
    assert.match(prompt, /The bootstrap file is executable-only handoff plumbing: do not cat\/read\/inspect\/rerun\/redirect it after the first exact exec/);
    assert.match(prompt, /Never append 2>&1, \| head, \| tail, tee, cat, echo, timeout, parentheses, &&, \|\|, ;, or any other wrapper\/suffix\/prefix to the bootstrap command, SUMMARY_IMPLEMENT_CONTEXT_CMD, or a CHECK_\*_CMD command/);
    assert.match(prompt, /CLAIM_SUMMARY_FILE=\/tmp\/claim-summary-feature-dev_developer-spawner-test\.json/);
    assert.match(prompt, /The bootstrap command prints the authoritative quick handoff/);
    assert.match(prompt, /read IMPLEMENT_CONTEXT_FILE with the file read tool/);
    assert.match(prompt, /If IMPLEMENT_CONTEXT_FILE is unavailable, run SUMMARY_IMPLEMENT_CONTEXT_CMD exactly once/);
    assert.match(prompt, /Never redirect SUMMARY_IMPLEMENT_CONTEXT_CMD to a file/);
    assert.match(prompt, /Do NOT guess setfarm-summary topics such as story-brief, full, all, retry-worktree-patch, or retry-patch-files/);
    assert.match(prompt, /Do not read raw \/tmp\/claim-summary JSON while IMPLEMENT_CONTEXT_FILE exists/);
    assert.doesNotMatch(prompt, /current story brief, workdir/);
    assert.match(prompt, /outputContract\.requiredFields and outputContract\.format exactly/);
    assert.match(prompt, /guard-backed roles will reject prose-only summaries/);
    assert.match(prompt, /Use retryFeedback\.mode exactly from IMPLEMENT_CONTEXT_FILE/);
    assert.match(prompt, /If failureCategory is SCOPE_BLEED or SCOPE_WRITE_VIOLATION, first remove\/rework out-of-scope files/);
    assert.match(prompt, /retryFeedback\.restoreTargets first, then retryFeedback\.protectedSnippets from IMPLEMENT_CONTEXT_FILE/);
    assert.match(prompt, /retryFeedback\.actionableReviewThreads from IMPLEMENT_CONTEXT_FILE/);
    assert.match(prompt, /supervisorEvidence/);
    assert.match(prompt, /current-source scanner evidence/);
    assert.match(prompt, /mode="fix" means the blocker is an open implementation requirement/);
    assert.match(prompt, /mode="audit" means prior feedback may be stale/);
    assert.match(prompt, /gitPolicy/);
    assert.match(prompt, /Setfarm performs the scoped commit and PR handoff after gates pass/);
    assert.match(prompt, /designContracts\.screenMap, designContracts\.designDom, uiContract/);
    assert.match(prompt, /focused story-owned Stitch files from IMPLEMENT_CONTEXT_FILE as binding implementation sources/);
    assert.match(prompt, /Do NOT use OpenClaw read\/cat\/head\/sed\/grep\/node loops to print or dump the entire claim summary JSON/);
    assert.match(prompt, /retryDiscipline\.mode/);
    assert.match(prompt, /retryDiscipline\.mode="first-delta"/);
    assert.match(prompt, /retryDiscipline\.mode="semantic-fix"/);
    assert.match(prompt, /claimSummary\.runtimeDoneChecklist/);
    assert.match(prompt, /hard done checklist/);
    assert.match(prompt, /make a small scoped source delta before broad analysis\/build\/test/);
    assert.match(prompt, /src\/_probe\.tsx, src\/probe\.tsx, src\/features\/test-write\.ts, tmp\.ts, scratch\.tsx/);
    assert.match(prompt, /Never create a project file just to verify that writes persist/);
    assert.match(prompt, /Do NOT parse or dump claim\.input with jq\/sed\/head\/node loops/);
    assert.match(prompt, /Do NOT create scratch\/progress\/todo\/note\/probe\/test-write files inside WORKDIR/);
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
        currentStory: "Story US-001: Bootstrap story\n\nState and persistence must stay readable after whitespace normalization.",
        acceptanceCriteria: "1. State persists after save.\n2. Stored status remains visible.",
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
        integrationPolicy: {
          applies: true,
          summary: "This story may touch app/router/shell integration, so preserve existing reachable render paths before adding the current story.",
          requiredCheck: "Before STATUS: done, compare the app/router diff and confirm previous generated screen imports/render branches remain reachable while the current story screen is added.",
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
        implementEvidenceContract: {
          mode: "blocking",
          visualGate: "advisory",
          visualProvider: "minimax",
          intentPath: "/home/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees/run-us-001/.setfarm/implement/US-001/IMPLEMENT_INTENT.json",
          verificationRequestPath: "/home/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees/run-us-001/.setfarm/implement/US-001/IMPLEMENT_VERIFICATION_REQUEST.json",
          evidencePath: "/home/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees/run-us-001/.setfarm/implement/US-001/IMPLEMENT_EVIDENCE.json",
          instruction: "For runtime/UI stories, write IMPLEMENT_INTENT.json before broad coding and IMPLEMENT_VERIFICATION_REQUEST.json before STATUS: done. Setfarm owns IMPLEMENT_EVIDENCE.json and executes the runtime evidence. Use the top-level JSON key named schema; do not use $schema.",
          intentSchema: "top-level schema key, not $schema. Required exact JSON for interactive criteria: {\"schema\":\"setfarm.implement-intent.v1\",\"storyId\":\"<storyId>\",\"storyType\":\"ui_interactive\",\"acceptanceCriteria\":[{\"id\":\"AC-001\",\"description\":\"...\"}],\"runtimeEvidenceRequired\":{\"minFlowCount\":1}}. Use minFlowCount:0 only when acceptance criteria require no user/runtime interaction.",
          verificationRequestSchema: "top-level schema key, not $schema. Required exact JSON: {\"schema\":\"setfarm.implement-verification-request.v1\",\"storyId\":\"<storyId>\",\"status\":\"ready_for_orchestrator_verification\",\"interactionRequests\":[{\"id\":\"flow-1\",\"action\":\"click\",\"target\":\"[data-action-id='<action-id>']\",\"waitCondition\":\"dom_idle\",\"timeoutMs\":1000}],\"uncoveredCriteria\":[],\"knownGaps\":[]}. interactionRequests may be [] only when criteria require no interaction; otherwise request executable actions or list criteria in uncoveredCriteria. Interactions start from the app's initial loaded state and run in order; if the target is on a later surface, first include or implement a reachable opener action, then request the target action.",
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
          mode: "semantic-fix",
          instruction: "Generated-screen source retry discipline: do not inspect forbidden generated screen source.",
        },
        retryFeedback: {
          mode: "fix",
          category: "GENERATED_SCREEN_SHARED_READ",
          suggestion: "Use claim-summary designContracts instead of shared generated source.",
          blocker: "GENERATED_SCREEN_SHARED_READ: previous worker read src/screens/MainMenu.tsx",
          details: "GENERATED_SCREEN_SHARED_READ: previous worker read src/screens/MainMenu.tsx",
          actionableReviewThreads: [
            {
              threadId: "PRRT_bootstrap",
              file: "src/App.tsx",
              line: 12,
              author: "gemini-code-assist",
              comment: "Fix the scoped bootstrap regression.",
            },
          ],
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
      assert.doesNotMatch(out, /CURRENT_STORY_BRIEF=/);
      assert.doesNotMatch(out, /ACCEPTANCE_CRITERIA=/);
      assert.doesNotMatch(out, /\b tate\b|\bper i t|\b tatus\b/);
      assert.match(out, /STORY_BRANCH=run-us-001/);
      assert.match(out, /STORY_WORKDIR=\/home\/setrox\/\.openclaw\/workspaces\/workflows\/feature-dev\/agents\/developer\/story-worktrees\/run-us-001/);
      assert.match(out, /VERIFY_WORKDIR=\/home\/setrox\/\.openclaw\/workspaces\/workflows\/feature-dev\/agents\/developer\/story-worktrees\/run-us-001/);
      assert.match(out, /MAIN_REPO=\/home\/setrox\/projects\/bootstrap-sensor/);
      assert.match(out, /BUILD_CMD=npm run build/);
      assert.match(out, /TEST_CMD=npm run test:run/);
      assert.match(out, /LINT_CMD=true/);
      const checkScript = path.join(workdir, ".setfarm-bin", "setfarm-check");
      assert.ok(fs.existsSync(checkScript), "bootstrap should install setfarm-check");
      const checkScriptBody = fs.readFileSync(checkScript, "utf-8");
      assert.match(checkScriptBody, /Usage: setfarm-check build\|test\|lint/);
      assert.match(checkScriptBody, /SETFARM_CHECK_START \$kind/);
      const summaryScript = path.join(workdir, ".setfarm-bin", "setfarm-summary");
      assert.ok(fs.existsSync(summaryScript), "bootstrap should install setfarm-summary");
      const summaryScriptBody = fs.readFileSync(summaryScript, "utf-8");
      assert.match(summaryScriptBody, /Usage: setfarm-summary <printed SUMMARY_\*_CMD or RETRY_\*_CMD topic>/);
      assert.match(summaryScriptBody, /Use only the printed SUMMARY_\*_CMD and RETRY_\*_CMD commands exactly/);
      assert.doesNotMatch(summaryScriptBody, /git-policy\|integration-policy\|generated-screen-policy/);
      const evidenceEnv = { ...process.env, CLAIM_SUMMARY_FILE: claimSummaryFile };
      assert.match(execFileSync("bash", [summaryScript, "acceptance"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" }), /State persists after save/);
      const scopeOut = execFileSync("bash", [summaryScript, "scope-files"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" });
      assert.match(scopeOut, /^SCOPE_FILES=/);
      assert.match(scopeOut, /src\/App\.tsx/);
      const implementContext = JSON.parse(execFileSync("bash", [summaryScript, "implement-context"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" }));
      assert.equal(implementContext.mode, "implement-context");
      assert.match(implementContext.story.currentStory, /Boot trap/);
      assert.deepEqual(implementContext.scope.files, ["src/App.tsx"]);
      assert.equal(implementContext.checks.CHECK_BUILD_CMD, "bash .setfarm-bin/setfarm-check build");
      assert.match(JSON.stringify(implementContext.design), /MainMenu/);
      assert.match(execFileSync("bash", [summaryScript, "--help"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }), /^$/);
      assert.match(execFileSync("bash", [summaryScript, "checks"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" }), /bash \.setfarm-bin\/setfarm-check build/);
      assert.match(execFileSync("bash", [summaryScript, "git-policy"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" }), /setfarm-platform/);
      assert.match(execFileSync("bash", [summaryScript, "workdirs"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" }), /run-us-001/);
      assert.match(execFileSync("bash", [summaryScript, "screen-usage-contract"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" }), /MainMenu/);
      assert.match(execFileSync("bash", [summaryScript, "design-contracts"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" }), /Main Menu/);
      const evidenceScript = path.join(workdir, ".setfarm-bin", "setfarm-evidence");
      assert.ok(fs.existsSync(evidenceScript), "bootstrap should install setfarm-evidence");
      const evidenceScriptBody = fs.readFileSync(evidenceScript, "utf-8");
      assert.match(evidenceScriptBody, /Usage: setfarm-evidence init/);
      assert.match(evidenceScriptBody, /unsupported: ' \+ action/);
      assert.match(out, /IMPLEMENT_EVIDENCE_SEEDED=default snapshot request ready/);
      assert.equal(execFileSync("bash", [evidenceScript, "validate"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" }).trim(), "SETFARM_EVIDENCE_OK");
      execFileSync(evidenceScript, ["validate"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" });
      execFileSync(evidenceScript, ["action", "--action-id", "start-game-1"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" });
      assert.equal(execFileSync(evidenceScript, ["validate"], { cwd: workdir, env: evidenceEnv, encoding: "utf-8" }).trim(), "SETFARM_EVIDENCE_OK");
      const intent = JSON.parse(fs.readFileSync(path.join(workdir, ".setfarm", "implement", "US-001", "IMPLEMENT_INTENT.json"), "utf-8"));
      const request = JSON.parse(fs.readFileSync(path.join(workdir, ".setfarm", "implement", "US-001", "IMPLEMENT_VERIFICATION_REQUEST.json"), "utf-8"));
      assert.equal(intent.schema, "setfarm.implement-intent.v1");
      assert.equal(intent.runtimeEvidenceRequired.minFlowCount, 1);
      assert.match(intent.acceptanceCriteria[0].description, /State persists after save/);
      assert.doesNotMatch(intent.acceptanceCriteria[0].description, /\b tate\b|\bper i t/);
      assert.deepEqual(request.interactionRequests, [{
        id: "start-game-1",
        action: "click",
        actionId: "start-game-1",
        target: '[data-action-id="start-game-1"]',
        waitCondition: "dom_idle",
        timeoutMs: 1000,
      }]);
      assert.match(out, /SCOPE_FILES=src\/App\.tsx/);
      assert.match(out, /MISSING_SCOPE_FILES=src\/App\.tsx/);
      assert.match(out, /SCOPE_FILE_POLICY=.*Missing scope files are expected new owned files/);
      assert.doesNotMatch(out, /GIT_POLICY=Developer story agents write code only/);
      assert.doesNotMatch(out, /FORBIDDEN_GIT=git add, git commit, git push/);
      assert.match(out, /SCREEN_USAGE=Use compact screen contract first/);
      assert.match(out, /SCREEN_COMPONENT=MainMenu src\/screens\/MainMenu\.tsx forbidden actions=start-game-1\|settings-4/);
      assert.doesNotMatch(out, /FAILURE_CATEGORY=GENERATED_SCREEN_SHARED_READ/);
      assert.doesNotMatch(out, /PR_REVIEW_THREAD_1=/);
      assert.match(out, /DETAILS_RULE=Initial bootstrap output intentionally omits long story, retry, PR, and supervisor text/);
      assert.match(out, /IMPLEMENT_CONTEXT_FILE=.*\/\.setfarm\/implement-context\.json/);
      assert.doesNotMatch(out, /SUMMARY_IMPLEMENT_CONTEXT_CMD=/);
      assert.match(out, /SUMMARY_HELPER_RULE=IMPLEMENT_CONTEXT_FILE is ready; do not run setfarm-summary or retry helper commands/);
      const implementContextFile = path.join(workdir, ".setfarm", "implement-context.json");
      assert.ok(fs.existsSync(implementContextFile), "bootstrap should write IMPLEMENT_CONTEXT_FILE");
      const implementContextJson = JSON.parse(fs.readFileSync(implementContextFile, "utf-8"));
      assert.equal(implementContextJson.mode, "implement-context");
      assert.match(implementContextJson.rules.join("\n"), /do not guess or run setfarm-summary topics while this file exists/);
      assert.match(implementContextJson.rules.join("\n"), /Do not read \.setfarm-bin\/\* helper scripts/);
      assert.match(implementContextJson.rules.join("\n"), /Do not read shared generated src\/screens\/\*\.tsx source/);
      assert.match(implementContextJson.rules.join("\n"), /do not replace it with npx\/npm\/tsc\/vitest guesses/);
      assert.match(out, /RETRY_ACTION=Use claim-summary designContracts instead of shared generated source/);
      assert.match(out, /RETRY_INSTRUCTION=Previous feedback is an open implementation blocker/);
      assert.match(out, /RETRY_DISCIPLINE=semantic-fix: Generated-screen source retry discipline/);
      assert.match(out, /PREVIOUS_FAILURE=present \d+ chars/);
      assert.match(out, /GENERATED_SCREEN_POLICY=No generated screen source file is in scope/);
      assert.match(out, /INTEGRATION_POLICY=This story may touch app\/router\/shell integration/);
      assert.match(out, /INTEGRATION_CHECK=Before STATUS: done, compare the app\/router diff/);
      assert.match(out, /IMPLEMENT_EVIDENCE_GATE=mode=blocking visual=advisory provider=minimax/);
      assert.match(out, /IMPLEMENT_INTENT_PATH=.*\/\.setfarm\/implement\/US-001\/IMPLEMENT_INTENT\.json/);
      assert.match(out, /IMPLEMENT_VERIFICATION_REQUEST_PATH=.*\/\.setfarm\/implement\/US-001\/IMPLEMENT_VERIFICATION_REQUEST\.json/);
      assert.match(out, /IMPLEMENT_EVIDENCE_PATH_SETFARM_OWNS=.*\/\.setfarm\/implement\/US-001\/IMPLEMENT_EVIDENCE\.json/);
      assert.match(out, /IMPLEMENT_EVIDENCE_RULE=For runtime\/UI stories, write IMPLEMENT_INTENT\.json/);
      assert.match(out, /IMPLEMENT_EVIDENCE_RULE=.*top-level JSON key named schema; do not use \$schema/);
      assert.match(out, /IMPLEMENT_EVIDENCE_HELPER=Default valid intent\/request are already seeded/);
      assert.match(out, /setfarm-evidence snapshot --target window\.app/);
      assert.match(out, /setfarm-evidence action --action-id <visible-action-id>/);
      assert.match(out, /IMPLEMENT_INTENT_SCHEMA=top-level schema key, not \$schema/);
      assert.match(out, /IMPLEMENT_INTENT_SCHEMA=.*"schema":"setfarm\.implement-intent\.v1"/);
      assert.match(out, /IMPLEMENT_VERIFICATION_REQUEST_SCHEMA=top-level schema key, not \$schema/);
      assert.match(out, /IMPLEMENT_VERIFICATION_REQUEST_SCHEMA=.*"schema":"setfarm\.implement-verification-request\.v1"/);
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

  it("treats Stitch as binding design source when no generated screen corpus exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-static-design-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "index.html\nassets/js/app.js\n");
      fs.writeFileSync(path.join(tmp, "stitch", "SCREEN_MAP.json"), JSON.stringify({
        screens: [{ screenId: "record-operations", htmlFile: "stitch/record-operations.html" }],
      }));
      fs.writeFileSync(path.join(tmp, "stitch", "UI_CONTRACT.json"), JSON.stringify([
        { screenId: "record-operations", screenTitle: "Record Operations", buttons: [{ label: "Create Record" }] },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "record-operations": {
            title: "Record Operations",
            cards: [{ title: "Q3 Metric Anomaly" }],
            tables: [{ label: "Operations table" }],
            buttons: [{ label: "Create Record" }],
          },
        },
      }));

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
        storyId: "US-002",
        input: [
          "# Developer Task",
          "CURRENT STORY: Story US-002: Record Operations",
          "STORY_SCREENS=[{\"screenId\":\"record-operations\",\"name\":\"Record Operations\",\"htmlFile\":\"stitch/record-operations.html\"}]",
        ].join("\n"),
      });

      assert.deepEqual((summary.designContracts as any).generatedScreenFiles, []);
      assert.match(String((summary.generatedScreenPolicy as any).summary), /No generated screen source corpus exists/);
      assert.match(String((summary.generatedScreenPolicy as any).summary), /binding design implementation source/);
      assert.match(String((summary.designContracts as any).source), /Stitch HTML, DESIGN_DOM, UI_CONTRACT, and screen map are binding/);
      assert.match(String((summary.designContracts as any).rule), /visible structure/);
      assert.match(JSON.stringify((summary.designContracts as any).designDom), /Q3 Metric Anomaly/);
      assert.match(JSON.stringify((summary.designContracts as any).screenMap), /record-operations\.html/);
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
      assert.equal((summary.integrationPolicy as any).applies, true);
      assert.match((summary.integrationPolicy as any).summary, /preserve existing reachable render paths/i);
      assert.match((summary.integrationPolicy as any).requiredCheck, /previous generated screen imports\/render branches remain reachable/i);
      assert.equal((summary.implementEvidenceContract as any).mode, "blocking");
      assert.match(String((summary.implementEvidenceContract as any).intentPath), /\/\.setfarm\/implement\/US-001\/IMPLEMENT_INTENT\.json$/);
      assert.match(String((summary.implementEvidenceContract as any).verificationRequestPath), /\/\.setfarm\/implement\/US-001\/IMPLEMENT_VERIFICATION_REQUEST\.json$/);
      assert.match(String((summary.implementEvidenceContract as any).evidencePath), /\/\.setfarm\/implement\/US-001\/IMPLEMENT_EVIDENCE\.json$/);
      assert.match(String((summary.implementEvidenceContract as any).instruction), /do not use \$schema/);
      assert.match(String((summary.implementEvidenceContract as any).intentSchema), /"schema":"setfarm\.implement-intent\.v1"/);
      assert.match(String((summary.implementEvidenceContract as any).verificationRequestSchema), /"schema":"setfarm\.implement-verification-request\.v1"/);
      assert.match(String((summary.implementEvidenceContract as any).verificationRequestSchema), /initial loaded state/);
      assert.match(String((summary.implementEvidenceContract as any).verificationRequestSchema), /reachable opener action/);
      assert.equal((summary.designContracts as any).screenIndex.length, 2);
      assert.equal((summary.designContracts as any).uiContract.length, 1);
      assert.match(JSON.stringify((summary.designContracts as any).screenIndex), /START GAME/);
      assert.match(String((summary.designContracts as any).componentRegistry), /export \{ MainMenu \}/);
      assert.equal((summary.designContracts as any).componentTypes.length, 2);
      assert.match(JSON.stringify((summary.designContracts as any).componentTypes), /MainMenuProps/);
      assert.match(JSON.stringify((summary.designContracts as any).componentTypes), /MainMenuActionId.*start-game-1/);
      assert.match(String((summary.designContracts as any).source), /Generated screen contracts are the preferred source/);
      assert.match(String((summary.designContracts as any).rule), /Every owned product surface must match/);
      assert.match(String((summary.designContracts as any).source), /create source-tree probe files/);
      assert.match(String(summary.supervisorMemory), /forbidden generated screens/);
      assert.equal((summary.supervisorEvidence as any).storyStatus, "passed");
      assert.equal((summary.supervisorEvidence as any).counts.blockers, 0);
      assert.equal((summary.supervisorEvidence as any).counts.resolved, 1);
      assert.match(String((summary.supervisorEvidence as any).instruction), /Current-source scanner evidence/);
      assert.match(String(summary.previousFailure), /GENERATED_SCREEN_SHARED_READ/);
      assert.equal(summary.failureCategory, "GENERATED_SCREEN_SHARED_READ");
      assert.equal(summary.failureSuggestion, "Use claim-summary designContracts instead.");
      assert.equal((summary.retryFeedback as any).mode, "fix");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match((summary.retryFeedback as any).blocker, /GENERATED_SCREEN_SHARED_READ/);
      assert.match((summary.retryFeedback as any).suggestion, /claim-summary designContracts/);
      assert.match((summary.retryFeedback as any).instruction, /open implementation blocker/);
      assert.match(String((summary.retryDiscipline as any).instruction), /safeMetadataFiles/);
      assert.match(String(summary.acceptanceCriteria), /Pieces fall and rotate/);
      assert.match(String(summary.currentStory), /Story US-001: Tetris engine/);
      assert.match(JSON.stringify(summary.handoff), /Audit fallback only/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("omits raw retry worktree diffs from previous failure summaries", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-no-raw-diff-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/App.tsx\n");

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-001",
        input: [
          "TASK: Project: retry diff sensor",
          "CURRENT STORY: Story US-001: Retry diff sensor",
          "",
          "## Previous Failure / Retry Feedback",
          "IMPLEMENT_EVIDENCE_INCOMPLETE: request.schema is required.",
          "",
          "ALSO_FIX:",
          "RETRY_WORKTREE_PATCH:",
          "Setfarm captured the previous failed attempt before cleaning the retry worktree.",
          "```diff",
          "diff --git a/src/App.tsx b/src/App.tsx",
          "--- a/src/App.tsx",
          "+++ b/src/App.tsx",
          "@@ -1 +1 @@",
          "-old",
          "+new",
          "```",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.match(String(summary.previousFailure), /IMPLEMENT_EVIDENCE_INCOMPLETE/);
      assert.match(String(summary.previousFailure), /raw diffs are not safe claim context/);
      assert.doesNotMatch(String(summary.previousFailure), /diff --git/);
      assert.doesNotMatch(String(summary.previousFailure), /```diff/);
      assert.doesNotMatch(JSON.stringify(summary.retryFeedback), /diff --git/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("gives implementation evidence interaction failures an executable request discipline", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-retry-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/App.tsx\n");

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-001",
        input: [
          "TASK: Project: evidence retry sensor",
          "CURRENT STORY: Story US-001: Evidence retry sensor",
          "",
          "## Previous Failure / Retry Feedback",
          "IMPLEMENT_EVIDENCE_INCOMPLETE: Story US-001 reported STATUS: done without acceptable orchestrator-owned implementation evidence.",
          "IMPLEMENT_EVIDENCE_VERDICT_NOT_PASSED: evidence.verdict must be pass before story completion.",
          "IMPLEMENT_INTERACTION_FAILED: Unsupported or incomplete interaction: assert",
          "IMPLEMENT_INTERACTION_FAILED: locator.click: Timeout 1000ms exceeded while waiting for locator('[data-testid=\\'focus-pad-error\\'] button').first()",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "IMPLEMENT_EVIDENCE_INCOMPLETE");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /never use assert/);
      assert.match(String((summary.retryDiscipline as any).instruction), /uncoveredCriteria\/knownGaps/);
      assert.match(String((summary.retryDiscipline as any).instruction), /Do not report STATUS: done until runtime evidence can pass/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("exposes full retry worktree patch and source snapshot as structured retry context", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-full-retry-context-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/App.tsx\n");

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-001",
        input: [
          "TASK: Project: retry context sensor",
          "CURRENT STORY: Story US-001: Retry context sensor",
          "",
          "## Previous Failure / Retry Feedback",
          "DESIGN_MISMATCH: remove icon font.",
          "",
          "## Retry Worktree Patch Memory",
          "RETRY_WORKTREE_PATCH_MEMORY:",
          "RETRY_WORKTREE_PATCH_SOURCE: .setfarm/retry-patches/run-us-001.patch",
          "RETRY_WORKTREE_PATCH_TOUCHED_FILES: src/App.tsx, src/actions.ts",
          "RETRY_WORKTREE_PATCH_STATS: +2 -1 across 2 file(s)",
          "RETRY_WORKTREE_PATCH_BYTES: 92",
          "RETRY_WORKTREE_PATCH_BODY:",
          "```diff",
          "diff --git a/src/App.tsx b/src/App.tsx",
          "--- a/src/App.tsx",
          "+++ b/src/App.tsx",
          "@@ -1 +1 @@",
          "-old",
          "+new",
          "```",
          "",
          "## Retry Source Snapshot",
          "RETRY_SOURCE_SNAPSHOT:",
          "SCOPE_FILES: src/App.tsx",
          "SHARED_FILES: src/state.ts",
          "## Project file tree (git ls-files)",
          "src/App.tsx",
          "## Scope file contents",
          "### src/App.tsx",
          "```",
          "export const app = true;",
          "```",
          "",
          "## Claim Handoff",
        ].join("\n"),
      });

      const feedback = summary.retryFeedback as any;
      assert.match(String(summary.previousFailure), /DESIGN_MISMATCH/);
      assert.doesNotMatch(String(summary.previousFailure), /diff --git/);
      assert.match(feedback.worktreePatch.body, /diff --git a\/src\/App\.tsx/);
      assert.deepEqual(feedback.worktreePatch.touchedFiles, ["src/App.tsx", "src/actions.ts"]);
      assert.match(feedback.sourceSnapshot.section, /export const app = true/);
      assert.deepEqual(feedback.sourceSnapshot.scopeFiles, ["src/App.tsx"]);

      const claimSummaryFile = path.join(tmp, "claim-summary.json");
      fs.writeFileSync(claimSummaryFile, JSON.stringify(summary, null, 2));
      const bootstrap = buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile,
        stepId: "step-123",
        workdir,
      });
      fs.writeFileSync(path.join(tmp, "bootstrap.sh"), bootstrap, { mode: 0o755 });
      const out = execFileSync("bash", [path.join(tmp, "bootstrap.sh")], { encoding: "utf-8" });
      assert.doesNotMatch(out, /RETRY_WORKTREE_PATCH_CMD=/);
      assert.doesNotMatch(out, /RETRY_SOURCE_SNAPSHOT_CMD=/);
      const implementContext = JSON.parse(fs.readFileSync(path.join(workdir, ".setfarm", "implement-context.json"), "utf-8"));
      assert.match(implementContext.retry.retryFeedback.worktreePatch.body, /diff --git/);
      assert.match(implementContext.retry.retryFeedback.worktreePatch.body, /\+new/);
      assert.match(implementContext.retry.retryFeedback.sourceSnapshot.section, /SCOPE_FILES:/);
      const retryOut = execFileSync(path.join(workdir, ".setfarm-bin", "setfarm-summary"), ["retry-feedback"], {
        encoding: "utf-8",
        env: { ...process.env, CLAIM_SUMMARY_FILE: claimSummaryFile },
      });
      const retryAliasOut = execFileSync(path.join(workdir, ".setfarm-bin", "setfarm-summary"), ["retry"], {
        encoding: "utf-8",
        env: { ...process.env, CLAIM_SUMMARY_FILE: claimSummaryFile },
      });
      assert.match(retryOut, /"worktreePatch":/);
      assert.match(retryOut, /"sourceSnapshot":/);
      assert.doesNotMatch(retryOut, /diff --git a\/src\/App\.tsx/);
      assert.match(retryAliasOut, /"worktreePatch":/);
      assert.doesNotMatch(retryAliasOut, /diff --git a\/src\/App\.tsx/);
      const patchOut = execFileSync(path.join(workdir, ".setfarm-bin", "setfarm-summary"), ["retry-patch"], {
        encoding: "utf-8",
        env: { ...process.env, CLAIM_SUMMARY_FILE: claimSummaryFile },
      });
      assert.match(patchOut, /diff --git a\/src\/App\.tsx/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("omits retry worktree patches that would reintroduce design-contract violations", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-design-dirty-patch-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/index.css\nsrc/App.tsx\n");

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-001",
        input: [
          "TASK: Project: design dirty retry patch sensor",
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "BROAD_PROCESS_CLEANUP_VIOLATION: runtime cleanup was blocked.",
          "",
          "## Retry Worktree Patch Memory",
          "RETRY_WORKTREE_PATCH_MEMORY:",
          "RETRY_WORKTREE_PATCH_SOURCE: .setfarm/retry-patches/run-us-001.patch",
          "RETRY_WORKTREE_PATCH_TOUCHED_FILES: src/index.css",
          "RETRY_WORKTREE_PATCH_STATS: +2 -1 across 1 file(s)",
          "RETRY_WORKTREE_PATCH_BYTES: 180",
          "RETRY_WORKTREE_PATCH_BODY:",
          "```diff",
          "diff --git a/src/index.css b/src/index.css",
          "--- a/src/index.css",
          "+++ b/src/index.css",
          "@@ -1 +1,2 @@",
          "+@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');",
          "+.material-symbols-outlined { font-family: 'Material Symbols Outlined'; }",
          "```",
          "",
          "## Retry Source Snapshot",
          "RETRY_SOURCE_SNAPSHOT:",
          "SCOPE_FILES: src/index.css, src/App.tsx",
          "SHARED_FILES:",
          "## Scope file contents",
          "### src/index.css",
          "```",
          ":root { font-family: var(--font-body-md, \"Hanken Grotesk\"), \"Segoe UI\", sans-serif; }",
          "```",
          "",
          "## Claim Handoff",
        ].join("\n"),
      });

      const feedback = summary.retryFeedback as any;
      assert.equal(feedback.category, "BROAD_PROCESS_CLEANUP_VIOLATION");
      assert.equal(feedback.worktreePatch, undefined);
      assert.match(feedback.sourceSnapshot.section, /Hanken Grotesk/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("preserves PR review details but only routes in-scope actionable threads", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-pr-review-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/App.tsx\nsrc/store.ts\n");
      const longBody = "This review comment includes enough implementation context that it used to be truncated before later review threads reached the developer. ".repeat(12);
      const input = [
        "TASK: Project: PR retry sensor",
        "CURRENT STORY: Story US-001: PR retry sensor",
        "",
        "## Previous Failure / Retry Feedback",
        "PR_REVIEW_COMMENTS_OPEN: US-001 has actionable PR review comments that must be fixed before merge.",
        "",
        "## PR Comments (4 actionable)",
        "PR state: OPEN, checks: passing, mergeable: MERGEABLE, mergeStateStatus: CLEAN",
        "",
        `- [review-comment] thread=PRRT_one src/store.ts:10 @gemini-code-assist:\n  ${longBody}\n  Fix collision removal.`,
        `- [review-comment] thread=PRRT_two src/App.tsx:20 @gemini-code-assist:\n  ${longBody}\n  Fix selector resubscribe.`,
        `- [review-comment] thread=PRRT_three src/store.ts:30 @gemini-code-assist:\n  ${longBody}\n  Rename non-hook use-prefixed function.`,
        `- [review-comment] thread=PRRT_four src/game-runtime.ts:40 @gemini-code-assist:\n  ${longBody}\n  Throttle requestAnimationFrame to 60 FPS.`,
        "",
        "## Current Story",
      ].join("\n");

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-001",
        input,
      });

      assert.match(String(summary.previousFailure), /thread=PRRT_one/);
      assert.match(String(summary.previousFailure), /thread=PRRT_four/);
      assert.match(String((summary.retryFeedback as any).details), /thread=PRRT_four/);
      assert.match(String((summary.retryFeedback as any).blocker), /thread=PRRT_four/);
      assert.deepEqual((summary.retryFeedback as any).prThreadIds, ["PRRT_one", "PRRT_two", "PRRT_three"]);
      assert.deepEqual((summary.retryFeedback as any).outOfScopePrThreadIds, ["PRRT_four"]);
      assert.deepEqual(
        (summary.retryFeedback as any).actionableReviewThreads.map((thread: any) => ({
          threadId: thread.threadId,
          file: thread.file,
          line: thread.line,
          author: thread.author,
        })),
        [
          { threadId: "PRRT_one", file: "src/store.ts", line: 10, author: "gemini-code-assist" },
          { threadId: "PRRT_two", file: "src/App.tsx", line: 20, author: "gemini-code-assist" },
          { threadId: "PRRT_three", file: "src/store.ts", line: 30, author: "gemini-code-assist" },
        ],
      );
      assert.deepEqual(
        (summary.retryFeedback as any).outOfScopeReviewThreads.map((thread: any) => ({
          threadId: thread.threadId,
          file: thread.file,
          line: thread.line,
          author: thread.author,
        })),
        [
          { threadId: "PRRT_four", file: "src/game-runtime.ts", line: 40, author: "gemini-code-assist" },
        ],
      );
      assert.match((summary.retryFeedback as any).outOfScopeReviewThreads[0].comment, /Throttle requestAnimationFrame to 60 FPS/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("omits retry worktree patches from PR review comment retry summaries", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-pr-review-no-patch-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/App.tsx\n");
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-003",
        input: [
          "TASK: Project: PR retry sensor",
          "CURRENT STORY: Story US-003: PR retry sensor",
          "",
          "## Previous Failure / Retry Feedback",
          "PR_REVIEW_COMMENTS_OPEN: US-003 has actionable PR review comments that must be fixed before merge.",
          "",
          "## PR Comments (1 actionable)",
          "- [review-comment] thread=PRRT_one src/App.tsx:42 @gemini-code-assist:",
          "  Guard item.price before toFixed.",
          "",
          "## Retry Source Snapshot",
          "RETRY_SOURCE_SNAPSHOT:",
          "SCOPE_FILES: src/App.tsx",
          "## Scope file contents",
          "### src/App.tsx",
          "```",
          "export const hugeContext = true;",
          "```",
          "",
          "## Retry Worktree Patch Memory",
          "RETRY_WORKTREE_PATCH_MEMORY:",
          "RETRY_WORKTREE_PATCH_SOURCE: .setfarm/retry-patches/run-us-003.patch",
          "RETRY_WORKTREE_PATCH_TOUCHED_FILES: src/App.tsx",
          "RETRY_WORKTREE_PATCH_BODY:",
          "```diff",
          "diff --git a/src/App.tsx b/src/App.tsx",
          "--- a/src/App.tsx",
          "+++ b/src/App.tsx",
          "-const preserved = true;",
          "+const replayed = true;",
          "```",
          "",
          "## Current Story",
        ].join("\n"),
      });

      const retryFeedback = summary.retryFeedback as any;
      assert.equal(retryFeedback.category, "PR_REVIEW_COMMENTS_OPEN");
      assert.equal(retryFeedback.worktreePatch, undefined);
      assert.equal(retryFeedback.sourceSnapshot, undefined);
      assert.deepEqual(retryFeedback.prThreadIds, ["PRRT_one"]);
      assert.match(retryFeedback.actionableReviewThreads[0].comment, /Guard item\.price/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("extracts retry patch protected snippets into claim summary and bootstrap", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-retry-snippets-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/App.tsx\n");
      const input = [
        "TASK: Project: retry snippet sensor",
        "CURRENT STORY: Story US-003: Retry snippet sensor",
        "",
        "## Previous Failure / Retry Feedback",
        "RETRY_PATCH_REAPPLIED: Story US-003 repeated 3 deletion(s) from a previously rejected retry patch.",
        "Preserve/restore: 'filter-6': () => setPanel('filter'), | 'export-summary-7': () => setPanel('export'), | [createRecordAction],",
        "",
        "## Current Story",
      ].join("\n");

      const claimSummaryFile = path.join(tmp, "claim-summary.json");
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-003",
        input,
      });
      fs.writeFileSync(claimSummaryFile, JSON.stringify(summary, null, 2));

      assert.equal((summary.retryFeedback as any).category, "RETRY_PATCH_REAPPLIED");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.deepEqual((summary.retryFeedback as any).protectedSnippets, [
        "'filter-6': () => setPanel('filter'),",
        "'export-summary-7': () => setPanel('export'),",
        "[createRecordAction],",
      ]);

      const bootstrap = buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile,
        stepId: "step-123",
        workdir,
      });
      fs.writeFileSync(path.join(tmp, "bootstrap.sh"), bootstrap, { mode: 0o755 });
      const out = execFileSync("bash", [path.join(tmp, "bootstrap.sh")], { encoding: "utf-8" });
      assert.match(out, /IMPLEMENT_CONTEXT_FILE=.*\/\.setfarm\/implement-context\.json/);
      assert.doesNotMatch(out, /SUMMARY_IMPLEMENT_CONTEXT_CMD=/);
      assert.match(out, /SUMMARY_HELPER_RULE=IMPLEMENT_CONTEXT_FILE is ready; do not run setfarm-summary or retry helper commands/);
      assert.doesNotMatch(out, /RETRY_PROTECTED_SNIPPET_1=/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("summarizes retry patch restore targets by file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-retry-targets-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/App.tsx\nsrc/router.tsx\n");
      const input = [
        "TASK: Project: retry restore target sensor",
        "CURRENT STORY: Story US-003: Retry restore target sensor",
        "",
        "## Previous Failure / Retry Feedback",
        "RETRY_PATCH_REAPPLIED: Story US-003 repeated 3 deletion(s) from a previously rejected retry patch.",
        "Preserve/restore: import { PreviousScreen } from './PreviousScreen'; | case 'previous': return <PreviousScreen />",
        "",
        "## Retry Worktree Patch Memory",
        "RETRY_WORKTREE_PATCH_MEMORY:",
        "RETRY_WORKTREE_PATCH_SOURCE: .setfarm/retry-patches/run-us-003.patch",
        "RETRY_WORKTREE_PATCH_TOUCHED_FILES: src/App.tsx, src/router.tsx",
        "RETRY_WORKTREE_PATCH_BODY:",
        "```diff",
        "diff --git a/src/App.tsx b/src/App.tsx",
        "--- a/src/App.tsx",
        "+++ b/src/App.tsx",
        "-import { PreviousScreen } from './PreviousScreen';",
        "-const preserveActionBridge = createActionBridge(previousActions);",
        "+const currentOnly = true;",
        "diff --git a/src/router.tsx b/src/router.tsx",
        "--- a/src/router.tsx",
        "+++ b/src/router.tsx",
        "-case 'previous': return <PreviousScreen />",
        "-return routeMap.previous;",
        "diff --git a/src/state.ts b/src/state.ts",
        "--- a/src/state.ts",
        "+++ b/src/state.ts",
        "-export const preservedState = true;",
        "```",
        "",
        "## Current Story",
      ].join("\n");

      const claimSummaryFile = path.join(tmp, "claim-summary.json");
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-003",
        input,
      });
      fs.writeFileSync(claimSummaryFile, JSON.stringify(summary, null, 2));

      assert.deepEqual((summary.retryFeedback as any).restoreTargets, [
        {
          file: "src/App.tsx",
          lines: [
            "import { PreviousScreen } from './PreviousScreen';",
            "const preserveActionBridge = createActionBridge(previousActions);",
          ],
        },
        {
          file: "src/router.tsx",
          lines: [
            "case 'previous': return <PreviousScreen />",
            "return routeMap.previous;",
          ],
        },
      ]);
      assert.doesNotMatch(JSON.stringify((summary.retryFeedback as any).restoreTargets), /state\.ts/);

      const bootstrap = buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile,
        stepId: "step-123",
        workdir,
      });
      fs.writeFileSync(path.join(tmp, "bootstrap.sh"), bootstrap, { mode: 0o755 });
      const out = execFileSync("bash", [path.join(tmp, "bootstrap.sh")], { encoding: "utf-8" });
      assert.doesNotMatch(out, /SUMMARY_IMPLEMENT_CONTEXT_CMD=/);
      assert.match(out, /SUMMARY_HELPER_RULE=IMPLEMENT_CONTEXT_FILE is ready; do not run setfarm-summary or retry helper commands/);
      assert.doesNotMatch(out, /RETRY_RESTORE_TARGET_1=/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("turns app integration scope and prop regressions into invariant restore targets", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-integration-targets-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "src/App.tsx\nsrc/features/surf-insights/act_filter.ts\n");
      const input = [
        "TASK: Project: integration invariant sensor",
        "CURRENT STORY: Story US-003: Integration invariant sensor",
        "",
        "## Previous Failure / Retry Feedback",
        "APP_INTEGRATION_SCOPE_REGRESSION: app/router diff removes existing feature action wiring outside the current story scope (surf-record-editor, surf-record-operations). Later stories may add their own wiring but must not delete previous story action helpers or keyboard/control bridges without an explicit replacement contract.",
        "APP_INTEGRATION_PROP_REGRESSION: app/router diff removes prop \"actions\" from previously verified generated screen RecordEditorScreen (src/screens/RecordEditorScreen.tsx). Preserve prior screen state/action adapters when adding later screens, or replace them with an equivalent explicit adapter.",
        "",
        "## Retry Worktree Patch Memory",
        "RETRY_WORKTREE_PATCH_BODY:",
        "```diff",
        "diff --git a/src/App.tsx b/src/App.tsx",
        "--- a/src/App.tsx",
        "+++ b/src/App.tsx",
        "-import { useRecordEditorActions } from './features/surf-record-editor/useRecordEditorActions';",
        "-const editorActions = useRecordEditorActions();",
        "-return <RecordEditorScreen actions={editorActions} />;",
        "+return <InsightsScreen />;",
        "```",
        "",
        "## Current Story",
      ].join("\n");

      const claimSummaryFile = path.join(tmp, "claim-summary.json");
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-003",
        input,
      });
      fs.writeFileSync(claimSummaryFile, JSON.stringify(summary, null, 2));

      assert.equal((summary.retryFeedback as any).category, "APP_INTEGRATION_REGRESSION");
      assert.deepEqual((summary.retryFeedback as any).protectedSnippets.slice(0, 7), [
        "surf-record-editor",
        "features/surf-record-editor/",
        "surf-record-operations",
        "features/surf-record-operations/",
        "RecordEditorScreen",
        "actions=",
        "src/screens/RecordEditorScreen.tsx",
      ]);
      assert.deepEqual((summary.retryFeedback as any).restoreTargets, [
        {
          file: "src/App.tsx",
          lines: [
            "return <RecordEditorScreen actions={editorActions} />;",
            "import { useRecordEditorActions } from './features/surf-record-editor/useRecordEditorActions';",
            "const editorActions = useRecordEditorActions();",
          ],
        },
      ]);

      const bootstrap = buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile,
        stepId: "step-123",
        workdir,
      });
      fs.writeFileSync(path.join(tmp, "bootstrap.sh"), bootstrap, { mode: 0o755 });
      const out = execFileSync("bash", [path.join(tmp, "bootstrap.sh")], { encoding: "utf-8" });
      assert.doesNotMatch(out, /SUMMARY_IMPLEMENT_CONTEXT_CMD=/);
      assert.match(out, /SUMMARY_HELPER_RULE=IMPLEMENT_CONTEXT_FILE is ready; do not run setfarm-summary or retry helper commands/);
      assert.doesNotMatch(out, /RETRY_RESTORE_TARGET_1=/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("turns app integration semantic regressions into protected restore snippets", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-semantic-snippets-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "index.html\nassets/js/app.js\n");
      const input = [
        "TASK: Project: semantic contract sensor",
        "CURRENT STORY: Story US-003: Semantic contract sensor",
        "",
        "## Previous Failure / Retry Feedback",
        "APP_INTEGRATION_SEMANTIC_REGRESSION: app/router diff removes previously accepted semantic UI contract \"data-testid=counter-value\".",
        "APP_INTEGRATION_SEMANTIC_REGRESSION: app/router diff removes previously accepted semantic UI contract \"data-action-id=add\".",
        "APP_INTEGRATION_SEMANTIC_REGRESSION: app/router diff removes previously accepted semantic UI contract \"data-action-id=reset\".",
        "",
        "## Retry Worktree Patch Memory",
        "```diff",
        "diff --git a/assets/js/app.js b/assets/js/app.js",
        "--- a/assets/js/app.js",
        "+++ b/assets/js/app.js",
        "-article.innerHTML = '<button data-action-id=\"add\">Add</button>';",
        "-root.innerHTML = '';",
        "+article.appendChild(addButton);",
        "```",
        "",
        "## Current Story",
      ].join("\n");

      const claimSummaryFile = path.join(tmp, "claim-summary.json");
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-003",
        input,
      });
      fs.writeFileSync(claimSummaryFile, JSON.stringify(summary, null, 2));

      assert.equal((summary.retryFeedback as any).category, "APP_INTEGRATION_REGRESSION");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.deepEqual((summary.retryFeedback as any).protectedSnippets, [
        'data-testid="counter-value"',
        'data-action-id="add"',
        'data-action-id="reset"',
      ]);
      assert.deepEqual((summary.retryFeedback as any).restoreTargets, []);

      const bootstrap = buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile,
        stepId: "step-123",
        workdir,
      });
      fs.writeFileSync(path.join(tmp, "bootstrap.sh"), bootstrap, { mode: 0o755 });
      const out = execFileSync("bash", [path.join(tmp, "bootstrap.sh")], { encoding: "utf-8" });
      assert.doesNotMatch(out, /SUMMARY_IMPLEMENT_CONTEXT_CMD=/);
      assert.match(out, /SUMMARY_HELPER_RULE=IMPLEMENT_CONTEXT_FILE is ready; do not run setfarm-summary or retry helper commands/);
      assert.doesNotMatch(out, /RETRY_PROTECTED_SNIPPET_1=/);
      assert.doesNotMatch(out, /RETRY_RESTORE_TARGETS=/);
      assert.doesNotMatch(out, /article\.innerHTML/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("summarizes long story implementation contracts without emitting partial JSON", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-contract-truncation-"));
    try {
      const longContract = {
        owned_surface_ids: [],
        owned_screen_ids: [],
        owned_screen_files: [],
        owned_actions: [
          {
            id: "ACT_APP_STATE_BOOTSTRAP",
            trigger: "Application load and shared game shell initialization",
            state_change: "Initialize gameplay state, navigation target, storage status, and window.app test bridge.",
            ui_feedback: "The first rendered surface is the actual playable game/product state, not a landing page.",
          },
        ],
        state_contract: [
          "Own shared gameplay state, active screen, score/progress, level/difficulty where present, paused/gameOver, storage status, and last error.",
        ],
        persistence_contract: [
          "Persist only explicit game preferences/high score or PRD-required state; corrupted persisted data produces visible recovery feedback.",
        ],
        navigation_contract: [
          "Expose stable navigation/action handlers for screen-owner stories without implementing sibling screens in this story.",
        ],
        test_contract: [
          "window.app exposes live gameplay/product state and actions required by smoke/final tests.",
        ],
        resolved_scope_roles: [
          { role: "app_shell", path: "src/App.tsx", source: "scope_target" },
          { role: "state_store", path: "src/features/pulsegate-lite/pulsegate-lite.store.tsx", source: "scope_target" },
          { role: "fixture_data", path: "src/__fixtures__/pulsegate-lite.fixture.ts", source: "scope_target" },
          { role: "test_bridge", path: "src/test/bridge.ts", source: "scope_target" },
          { role: "runtime_loop", path: "src/game/game-runtime.ts", source: "scope_target" },
        ],
      };

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
          "TASK: Project: PulseGate Lite",
          "CURRENT STORY: Story US-001: PulseGate Lite - game engine, state and test bridge",
          "",
          "Acceptance Criteria:",
          "  1. Implement the story behavior described above and verify it in the running app.",
          "",
          "## Story Implementation Contract",
          "This is the behavior handoff from STORIES. Treat it as authoritative.",
          "",
          JSON.stringify(longContract, null, 2),
          "SCOPE: SCOPE ENFORCEMENT: You may ONLY write files in [src/App.tsx].",
        ].join("\n"),
      });

      assert.match(String(summary.acceptanceCriteria), /Story implementation contract summary/);
      assert.match(String(summary.acceptanceCriteria), /ACT_APP_STATE_BOOTSTRAP/);
      assert.match(String(summary.acceptanceCriteria), /runtime_loop:src\/game\/game-runtime\.ts/);
      assert.doesNotMatch(String(summary.acceptanceCriteria), /"role":\s*"fix$/);
      assert.doesNotMatch(String(summary.acceptanceCriteria), /resolved_scope_roles":\s*\[[\s\S]*"role":\s*"fix/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("treats product supervisor retry feedback as audit-first for developer claims", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-product-supervisor-audit-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      fs.writeFileSync(path.join(workdir, ".story-scope-files"), "index.html\n");
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        bootstrapFile: path.join(tmp, "bootstrap.sh"),
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-002",
        input: [
          "TASK: html: Build a compact single-page tool called Audit Sensor.",
          "CURRENT STORY: Story US-002: Audit Sensor screen",
          "",
          "## Previous Failure / Retry Feedback",
          "Failure category: PRODUCT_SUPERVISOR_BLOCKED",
          "Suggested response: Product supervisor blocked a contract drift.",
          "GUARDRAIL [product-supervisor:implement]: IMPLEMENT_INTERACTION_CONTRACT: active controls or URLs are not wired correctly.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal((summary.retryFeedback as any).category, "PRODUCT_SUPERVISOR_BLOCKED");
      assert.equal((summary.retryFeedback as any).mode, "audit");
      assert.match((summary.retryFeedback as any).instruction, /First verify whether it is already resolved/);
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

  it("filters stale resolved supervisor blockers from claim summaries", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stale-supervisor-blocker-"));
    try {
      const workdir = path.join(tmp, "worktree");
      fs.mkdirSync(path.join(workdir, ".setfarm", "supervisor", "run-123"), { recursive: true });
      fs.writeFileSync(path.join(workdir, ".setfarm", "supervisor", "run-123", "SUPERVISOR_STATE.json"), JSON.stringify({
        schema: "setfarm.supervisor-state.v1",
        runId: "run-123",
        projectStatus: "blocked",
        updatedAt: "2026-05-17T00:00:00.000Z",
        stories: {
          "US-002": {
            status: "blocked",
            openBlockers: ["visual:viewport_integrity-desktop-root"],
            warnings: [],
            resolved: ["visual:viewport_integrity-desktop-root", "llm-supervisor:US-002:decision"],
            lastEvidenceAt: "2026-05-17T00:00:00.000Z",
          },
        },
        evidence: {
          "visual:viewport_integrity-desktop-root": {
            itemId: "visual:viewport_integrity-desktop-root",
            storyId: "US-002",
            status: "passed",
            severity: "blocker",
            observed: ["Resolved by a later successful visual QA scan."],
            lastScan: "visual-qa",
            files: ["src/screens/Gameplay.tsx"],
            message: "Visual QA passed after this previous visual finding.",
            checkedAt: "2026-05-17T00:01:00.000Z",
          },
          "llm-supervisor:US-002:decision": {
            itemId: "llm-supervisor:US-002:decision",
            storyId: "US-002",
            status: "passed",
            severity: "info",
            observed: ["SUPERVISOR_DECISION: pass"],
            lastScan: "llm-supervisor",
            files: [],
            message: "Story-scoped supervisor completed with pass.",
            checkedAt: "2026-05-17T00:01:30.000Z",
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
        storyId: "US-002",
        input: [
          "TASK: stale visual blocker",
          `WORKDIR: ${workdir}`,
          "CURRENT STORY: Story US-002: Gameplay",
        ].join("\n"),
      });

      assert.equal((summary.supervisorEvidence as any).storyStatus, "passed");
      assert.equal((summary.supervisorEvidence as any).counts.blockers, 0);
      assert.equal((summary.supervisorEvidence as any).blockers.length, 0);
      assert.equal((summary.supervisorEvidence as any).counts.resolved, 2);
      assert.match(JSON.stringify((summary.supervisorEvidence as any).recentlyResolved), /viewport_integrity/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("prefers newer supervisor pass evidence over stale blocked sibling evidence", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-sibling-recency-"));
    try {
      const agentsRoot = path.join(tmp, "workflows", "feature-dev", "agents");
      const storyBranch = "run-us-002";
      const developerWorkdir = path.join(agentsRoot, "developer", "story-worktrees", storyBranch);
      const supervisorWorkdir = path.join(agentsRoot, "supervisor", "story-worktrees", storyBranch);
      const reviewerWorkdir = path.join(agentsRoot, "reviewer", "story-worktrees", storyBranch);
      for (const dir of [developerWorkdir, supervisorWorkdir, reviewerWorkdir]) {
        fs.mkdirSync(path.join(dir, ".setfarm", "supervisor", "run-123"), { recursive: true });
      }

      fs.writeFileSync(path.join(developerWorkdir, ".setfarm", "supervisor", "run-123", "SUPERVISOR_STATE.json"), JSON.stringify({
        schema: "setfarm.supervisor-state.v1",
        runId: "run-123",
        projectStatus: "blocked",
        updatedAt: "2026-05-17T00:00:00.000Z",
        stories: {
          "US-002": {
            status: "blocked",
            openBlockers: ["visual:layout-overflow-mobile-root"],
            warnings: [],
            resolved: [],
            lastEvidenceAt: "2026-05-17T00:00:00.000Z",
          },
        },
        evidence: {
          "visual:layout-overflow-mobile-root": {
            itemId: "visual:layout-overflow-mobile-root",
            storyId: "US-002",
            status: "failed",
            severity: "blocker",
            observed: ["layout_overflow mobile"],
            lastScan: "visual-qa",
            files: ["src/screens/Gameplay.tsx"],
            message: "Visual QA layout_overflow on mobile.",
            checkedAt: "2026-05-17T00:00:00.000Z",
          },
        },
        interventions: [],
      }, null, 2));

      fs.writeFileSync(path.join(supervisorWorkdir, ".setfarm", "supervisor", "run-123", "SUPERVISOR_STATE.json"), JSON.stringify({
        schema: "setfarm.supervisor-state.v1",
        runId: "run-123",
        projectStatus: "implementing",
        updatedAt: "2026-05-17T00:05:00.000Z",
        stories: {
          "US-002": {
            status: "passed",
            openBlockers: [],
            warnings: [],
            resolved: ["visual:layout-overflow-mobile-root", "llm-supervisor:US-002:decision"],
            lastEvidenceAt: "2026-05-17T00:05:00.000Z",
          },
        },
        evidence: {
          "visual:layout-overflow-mobile-root": {
            itemId: "visual:layout-overflow-mobile-root",
            storyId: "US-002",
            status: "passed",
            severity: "blocker",
            observed: ["Desktop and mobile overflow checks returned zero overflows."],
            lastScan: "visual-qa",
            files: ["src/screens/Gameplay.tsx"],
            message: "Visual QA passed after this previous visual finding.",
            checkedAt: "2026-05-17T00:05:00.000Z",
          },
          "llm-supervisor:US-002:decision": {
            itemId: "llm-supervisor:US-002:decision",
            storyId: "US-002",
            status: "passed",
            severity: "info",
            observed: ["SUPERVISOR_DECISION: pass"],
            lastScan: "llm-supervisor",
            files: [],
            message: "Story-scoped supervisor completed with pass.",
            checkedAt: "2026-05-17T00:05:30.000Z",
          },
        },
        interventions: [],
      }, null, 2));

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "reviewer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "run-123",
        workdir: reviewerWorkdir,
        repo: reviewerWorkdir,
        storyId: "US-002",
        input: [
          "TASK: sibling evidence recency",
          `WORKDIR: ${reviewerWorkdir}`,
          `STORY_BRANCH: ${storyBranch}`,
          "CURRENT STORY: Story US-002: Gameplay",
        ].join("\n"),
      });

      assert.equal((summary.supervisorEvidence as any).storyStatus, "passed");
      assert.match(String((summary.supervisorEvidence as any).workdir), /supervisor\/story-worktrees\/run-us-002$/);
      assert.equal((summary.supervisorEvidence as any).counts.blockers, 0);
      assert.equal((summary.supervisorEvidence as any).counts.resolved, 2);
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
      assert.deepEqual((summary as any).runtimeDoneChecklist, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("adds a browser-game runtime done checklist to claims", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-browser-game-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\nsrc/game/game-runtime.ts\nsrc/test/bridge.ts\n");
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
          "STACK_PACK_ID: browser-game-canvas",
          "TASK: Build a compact browser-game called VectorGate Lite.",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: VectorGate Lite - game engine, state and test bridge",
          "",
          "Acceptance Criteria:",
          "  1. Gameplay uses a live runtime loop.",
          "  2. Shared state is visible through window.app.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      const checklist = (summary as any).runtimeDoneChecklist;
      assert.equal(Array.isArray(checklist), true);
      assert.equal(checklist.length >= 5, true);
      assert.match(checklist.join("\n"), /data-setfarm-root/);
      assert.match(checklist.join("\n"), /setInterval|requestAnimationFrame/);
      assert.match(checklist.join("\n"), /window\.app|globalThis\.app/);

      const bootstrapFile = path.join(tmp, "bootstrap.sh");
      const claimFile = path.join(tmp, "claim.json");
      const claimSummaryFile = path.join(tmp, "claim-summary.json");
      fs.writeFileSync(claimFile, JSON.stringify({ stepId: "step-123", workdir: tmp, input: "" }) + "\n");
      fs.writeFileSync(claimSummaryFile, JSON.stringify(summary) + "\n");
      fs.writeFileSync(bootstrapFile, buildResolvedClaimBootstrapScript({
        claimFile,
        claimSummaryFile,
        outputFile: "/tmp/output.txt",
        stepId: "step-123",
        workdir: tmp,
        taskPreview: "browser game claim",
      }), { mode: 0o700 });
      const out = execFileSync("bash", [bootstrapFile], { encoding: "utf-8", timeout: 10_000 });
      assert.match(out, /RUNTIME_DONE_CHECKLIST=5 required invariant\(s\)/);
      assert.match(out, /RUNTIME_DONE_CHECK=.*setInterval or requestAnimationFrame/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not add browser-game checklist for explicit non-game score tools", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-non-game-score-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\nsrc/hooks/useStackHealth.ts\n");
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
          "TASK: Build a compact browser tool called StackLens Canary. Use a frontend web app stack, not a game. Show module risk score.",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: StackLens Canary - app shell, state and persistence",
          "",
          "Acceptance Criteria:",
          "  1. Risk score is visible.",
          "  2. Shared state is visible through window.app.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.deepEqual((summary as any).runtimeDoneChecklist, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not let retry feedback browser-game checklist contaminate non-game claims", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-non-game-retry-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "index.html\nassets/js/state.js\n");
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
          "TASK: html: Build a compact single-page incident tool called SignalDesk Mini.",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: SignalDesk Mini - app shell, state and persistence",
          "",
          "Acceptance Criteria:",
          "  1. Shared state is visible through window.app.",
          "",
          "## Previous Failure / Retry Feedback",
          "RUNTIME_DONE_CHECK=Browser-game runtime must contain a visible scheduled loop using setInterval or requestAnimationFrame.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.deepEqual((summary as any).runtimeDoneChecklist, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not add browser-game checklist when claim stack pack is explicitly web", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-web-stack-claim-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\nsrc/test/bridge.ts\n");
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
          "TASK: web: Build a compact status dashboard with score, level, and paused labels.",
          "STACK_PACK_ID: vite-react-web-app",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: Score dashboard - app shell",
          "",
          "Acceptance Criteria:",
          "  1. Score and paused labels are visible.",
          "  2. Shared state is visible through window.app.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.deepEqual((summary as any).runtimeDoneChecklist, []);
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

  it("gives package scope bleed a dependency-safe retry discipline", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-package-scope-bleed-"));
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
          "TASK: Project: package bleed sensor",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "SCOPE_BLEED: Story US-001 committed QA/test artifact(s) that do not belong in product code: package-lock.json, package.json.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "SCOPE_BLEED");
      assert.match(String(summary.failureSuggestion), /package\/dependency files/);
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /Do not install dependencies/);
      assert.match(String((summary.retryDiscipline as any).instruction), /setup-build\/stack-pack dependency blocker/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("gives package scope writes a dependency-safe retry discipline", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-package-scope-write-"));
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
          "TASK: Project: package write sensor",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "SCOPE_WRITE_VIOLATION: feature-dev_developer changed package/dependency file(s) outside .story-scope-files: package.json.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "SCOPE_WRITE_VIOLATION");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /Do not install dependencies/);
      assert.match(String((summary.retryDiscipline as any).instruction), /setup-build\/stack-pack dependency blocker/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("gives project-tree debug probe scope writes a source-clean retry discipline", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-debug-probe-scope-write-"));
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
          "TASK: Project: debug probe sensor",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "SCOPE_WRITE_VIOLATION: feature-dev_developer changed file(s) outside .story-scope-files via shell/runtime side effects: src/__fixtures__/test-write.txt. Runtime supervisor killed the claim before out-of-scope work could be committed.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "SCOPE_WRITE_VIOLATION");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /Do not create _debug\.test\.ts, test-write\.txt/);
      assert.match(String((summary.retryDiscipline as any).instruction), /git diff\/status/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("gives masked check retries an unmasked command discipline", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-masked-check-retry-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
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
          "TASK: Project: masked check retry sensor",
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "MASKED_CHECK_COMMAND: feature-dev_developer ran deterministic build/test evidence through an output-filtering pipeline (npx vitest run src/App.test.tsx 2>&1 | head -100).",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "MASKED_CHECK_COMMAND");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /CHECK_BUILD_CMD, CHECK_TEST_CMD, or CHECK_LINT_CMD is present, run that printed command exactly/i);
      assert.match(String((summary.retryDiscipline as any).instruction), /Do not append, prepend, wrap, pipe, tee, redirect, timeout, group, or combine it/i);
      assert.match(String((summary.retryDiscipline as any).instruction), /do not rerun the old masked ad hoc command/i);
      assert.match(String((summary.retryDiscipline as any).instruction), /npm run build 2>&1 \| tail -40; echo \$\?/);
      assert.match(String((summary.retryDiscipline as any).instruction), /bash \.setfarm-bin\/setfarm-check test 2>&1 \| tail -40/);
      assert.match(String((summary.retryDiscipline as any).instruction), /After the declared checks and setfarm-evidence validate pass, write the output contract, call step complete, and stop/i);
      assert.match(String((summary.retryDiscipline as any).instruction), /do not run optional extra vitest\/tsc\/eslint probes/i);
      const bootstrap = buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile: path.join(tmp, "summary.json"),
        stepId: "step-123",
        workdir: tmp,
      });
      assert.match(bootstrap, /MASKED_CHECK_RULE=Use CHECK_BUILD_CMD\/CHECK_TEST_CMD when present, exactly as printed and as standalone commands/);
      assert.match(bootstrap, /MASKED_CHECK_EXACT_BUILD_CMD=/);
      assert.match(bootstrap, /MASKED_CHECK_EXACT_TEST_CMD=/);
      assert.match(bootstrap, /MASKED_CHECK_DONE_GATE=Before STATUS: done, run CHECK_BUILD_CMD\/CHECK_TEST_CMD when present exactly as printed/);
      assert.match(bootstrap, /CHECK_CMD_ATOMIC_RULE=Run each CHECK_\*_CMD value exactly as printed/);
      assert.match(bootstrap, /CHECK_BUILD_CMD=bash \.setfarm-bin\/setfarm-check build/);
      assert.match(bootstrap, /CHECK_TEST_CMD=bash \.setfarm-bin\/setfarm-check test/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("classifies masked check retry reports embedded in the current story", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-current-story-masked-check-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ scripts: { build: "vite build", "test:run": "vitest run" } }));
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src", "App.tsx"), "export default function App() { return null; }\n");
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");

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
          "TASK: Project: current story masked check",
          "CURRENT STORY: Story US-001: App shell",
          "",
          "Failure report:",
          "MASKED_CHECK_COMMAND: feature-dev_developer ran deterministic build/test evidence through an output-filtering pipeline (timeout 30 npx vitest run --reporter=verbose --no-color 2>&1 | head -80; echo \"EXIT=$?\").",
          "",
          "Acceptance Criteria:",
          "  1. Implement the story behavior described above and verify it in the running app.",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "MASKED_CHECK_COMMAND");
      assert.match(String((summary.retryDiscipline as any).instruction), /run that printed command exactly as its own shell command/i);
      assert.match(String((summary.retryFeedback as any).details), /MASKED_CHECK_COMMAND/);
      assert.match(String(summary.currentStory), /Story US-001: App shell/);
      assert.doesNotMatch(String(summary.currentStory), /MASKED_CHECK_COMMAND|Failure report/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps quality gate retry reports out of the current story handoff", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-current-story-quality-gate-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ scripts: { build: "vite build", "test:run": "vitest run" } }));
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src", "App.tsx"), "export default function App() { return null; }\n");
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");

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
          "TASK: Project: current story quality gate",
          "CURRENT STORY: Story US-001: App shell",
          "",
          "QUALITY GATE: 1 error(s), 0 warning(s)",
          "  [ERROR] generated_screen_shell_layout: GENERATED_SCREEN_SHELL_CHROME_UNSAFE: src/App.tsx renders visible diagnostic chrome.",
          "Fix these issues and retry.",
          "",
          "Acceptance Criteria:",
          "  1. Implement the story behavior described above and verify it in the running app.",
        ].join("\n"),
      });

      assert.match(String(summary.currentStory), /Story US-001: App shell/);
      assert.doesNotMatch(String(summary.currentStory), /QUALITY GATE|GENERATED_SCREEN_SHELL_CHROME_UNSAFE/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("steers generated screen mount retries to the diagnostic file generically", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-generated-mount-retry-"));
    try {
      fs.mkdirSync(path.join(tmp, "src", "shell"), { recursive: true });
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/shell/RootSurface.tsx\nsrc/features/insights/actions.ts\n");
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
        storyId: "US-003",
        input: [
          "TASK: Project: generated mount retry sensor",
          "CURRENT STORY: Story US-003: Insights surface",
          "",
          "## Previous Failure / Retry Feedback",
          "GUARDRAIL: Quality gate failed — 1 error(s) detected.",
          "GENERATED_SCREEN_VIEWPORT_MOUNT_UNSAFE: src/shell/RootSurface.tsx mounts an absolute/fixed generated full-screen Stitch screen inside a data-setfarm-root container without stable viewport height and positioning.",
          "IMPLEMENT_EVIDENCE_INCOMPLETE: Runtime evidence also failed because target action ids were not visible.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "GENERATED_SCREEN_VIEWPORT_MOUNT_UNSAFE");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /Generated-screen mount retry discipline/);
      assert.match(String((summary.retryDiscipline as any).instruction), /Reported file\(s\): src\/shell\/RootSurface\.tsx/);
      assert.match(String((summary.retryDiscipline as any).instruction), /not a hardcoded project path/);
      assert.match(String((summary.retryDiscipline as any).instruction), /data-setfarm-root wrapper/);
      assert.match(String((summary.retryDiscipline as any).instruction), /relative flex min-h-screen w-full overflow-hidden/);
      assert.match(String((summary.retryDiscipline as any).instruction), /Preserve generated screen components and previously verified action\/prop adapters/);
      assert.match(String((summary.retryDiscipline as any).instruction), /do not rewrite generated screens, test fixtures, evidence JSON, or unrelated config before this mount fix/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps unmasked check discipline visible during PR review retries", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-pr-review-check-rule-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
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
          "TASK: Project: PR review retry sensor",
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "Failure category: PR_REVIEW_COMMENTS_OPEN",
          "Suggested response: Address every actionable PR review comment.",
          "PR_REVIEW_COMMENTS_OPEN: US-001 has actionable PR review comments that must be fixed before merge.",
          "- [review-comment] thread=PRRT_one src/App.tsx:10 @reviewer: Keep storage errors visible.",
          "",
          "BUILD_CMD: npm run build",
          "TEST_CMD: npm run test:run",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "PR_REVIEW_COMMENTS_OPEN");
      assert.doesNotMatch(String(summary.previousFailure), /MASKED_CHECK_COMMAND/);

      const summaryFile = path.join(tmp, "summary.json");
      fs.writeFileSync(summaryFile, JSON.stringify(summary));
      const bootstrapFile = path.join(tmp, "bootstrap.sh");
      fs.writeFileSync(bootstrapFile, buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile: summaryFile,
        stepId: "step-123",
        workdir: tmp,
      }));
      fs.chmodSync(bootstrapFile, 0o755);
      const out = execFileSync("bash", [bootstrapFile], { cwd: tmp, encoding: "utf8" });

      assert.doesNotMatch(out, /FAILURE_CATEGORY=PR_REVIEW_COMMENTS_OPEN/);
      assert.doesNotMatch(out, /PR_REVIEW_ACTIONABLE_THREADS=1/);
      assert.doesNotMatch(out, /SUMMARY_IMPLEMENT_CONTEXT_CMD=/);
      assert.match(out, /IMPLEMENT_LOOP=Edit scoped source, run CHECK_BUILD_CMD exactly, run CHECK_TEST_CMD exactly/);
      assert.match(out, /CHECK_BUILD_CMD=bash \.setfarm-bin\/setfarm-check build/);
      assert.match(out, /CHECK_TEST_CMD=bash \.setfarm-bin\/setfarm-check test/);
      assert.match(out, /CHECK_CMD_ATOMIC_RULE=Run each CHECK_\*_CMD value exactly as printed/);
      assert.match(out, /SUMMARY_HELPER_RULE=IMPLEMENT_CONTEXT_FILE is ready; do not run setfarm-summary or retry helper commands/);
      assert.match(out, /MASKED_CHECK_RULE=Use CHECK_BUILD_CMD\/CHECK_TEST_CMD when present, exactly as printed and as standalone commands/);
      assert.match(out, /MASKED_CHECK_EXACT_BUILD_CMD=npm run build/);
      assert.match(out, /MASKED_CHECK_EXACT_TEST_CMD=npm run test:run/);
      assert.match(out, /MASKED_CHECK_DONE_GATE=Before STATUS: done, run CHECK_BUILD_CMD\/CHECK_TEST_CMD when present exactly as printed/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("gives design mismatch retries an exact UI contract fix discipline", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-mismatch-retry-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/index.css\n");
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
          "TASK: Project: design mismatch retry sensor",
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "DESIGN MISMATCH:",
          "- CRITICAL DESIGN CONTRACT:",
          "src/index.css:70 — UI_CONTRACT: banned primary font \"inter\" in font-family; use project design tokens or a distinctive approved font first.",
          "FIX:",
          "- Replace the banned primary font with the project design token font or an approved distinctive font.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "DESIGN_MISMATCH");
      assert.equal((summary.retryDiscipline as any).mode, "semantic-fix");
      assert.match(String((summary.retryDiscipline as any).instruction), /fix the exact reported file and UI_CONTRACT\/design-token line/i);
      assert.match(String((summary.retryDiscipline as any).instruction), /Search the scoped files for the rejected token or pattern/i);
      const bootstrap = buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile: path.join(tmp, "summary.json"),
        stepId: "step-123",
        workdir: tmp,
      });
      assert.match(bootstrap, /DESIGN_RETRY_RULE=Fix the exact UI_CONTRACT\/design-token file and line first/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("prefers a later meaningful retry failure category over UNKNOWN", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-meaningful-failure-category-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
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
          "TASK: Project: runtime infra retry sensor",
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "Failure category: UNKNOWN",
          "Suggested response: Unexpected error — review agent output for details",
          "",
          "SETFARM_INFRA_RETRY:",
          "IMPLEMENT_EVIDENCE_RUNTIME_FAILED",
          "Failure category: browser_infra_failure",
          "",
          "Implementation evidence runner hit stack tooling infrastructure before product behavior could be judged.",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "browser_infra_failure");
      assert.equal((summary.retryFeedback as any).category, "browser_infra_failure");
      assert.doesNotMatch((summary.retryFeedback as any).blocker, /^Failure category: UNKNOWN/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("omits retry source snapshots and patch bodies for scope bleed retries", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-bleed-no-snapshot-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
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
          "TASK: Project: scope bleed retry sensor",
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "SCOPE_BLEED: Story US-001 modified 1 file(s) outside its SCOPE_FILES list: src/shared.ts.",
          "",
          "## Retry Source Snapshot",
          "RETRY_SOURCE_SNAPSHOT:",
          "SCOPE_FILES: src/App.tsx",
          "SHARED_FILES: src/shared.ts",
          "## Project file tree (git ls-files)",
          "src/App.tsx",
          "src/shared.ts",
          "## Scope file contents",
          "### src/App.tsx",
          "```",
          "export const app = true;",
          "```",
          "## Shared/dependency file contents",
          "### src/shared.ts",
          "```",
          "export const shared = true;",
          "```",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "SCOPE_BLEED");
      assert.equal((summary.retryFeedback as any).sourceSnapshot, undefined);
      assert.equal((summary.retryFeedback as any).worktreePatch, undefined);
      const bootstrap = buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile: path.join(tmp, "summary.json"),
        stepId: "step-123",
        workdir: tmp,
      });
      assert.match(bootstrap, /SCOPE_RETRY_RULE=First remove\/rework out-of-scope files/);
      assert.match(bootstrap, /\/tmp probe scripts via OpenClaw write\/edit/);
      assert.match(bootstrap, /Do not read retry source snapshots, do not read retry worktree patches/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("classifies scope write retries and hides contaminated retry artifacts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-write-no-patch-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
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
          "TASK: Project: scope write retry sensor",
          "CURRENT STORY: Story US-001: App shell",
          "",
          "## Previous Failure / Retry Feedback",
          "",
          "## Retry Worktree Patch Memory",
          "RETRY_WORKTREE_PATCH:",
          "Touched files: .tmp/retry.patch, src/test/_debug.test.tsx",
          "```diff",
          "diff --git a/src/test/_debug.test.tsx b/src/test/_debug.test.tsx",
          "+++ b/src/test/_debug.test.tsx",
          "+test('debug', () => {})",
          "```",
          "",
          "SCOPE_WRITE_VIOLATION: feature-dev_developer changed file(s) outside .story-scope-files via shell/runtime side effects: .tmp/retry.patch, src/test/_debug.test.tsx.",
          "",
          "## Retry Source Snapshot",
          "RETRY_SOURCE_SNAPSHOT:",
          "### src/test/_debug.test.tsx",
          "```",
          "test('debug', () => {})",
          "```",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "SCOPE_WRITE_VIOLATION");
      assert.equal((summary.retryFeedback as any).category, "SCOPE_WRITE_VIOLATION");
      assert.equal((summary.retryFeedback as any).sourceSnapshot, undefined);
      assert.equal((summary.retryFeedback as any).worktreePatch, undefined);
      assert.match(String((summary.retryDiscipline as any).instruction), /small scoped source delta/);
      const bootstrap = buildResolvedClaimBootstrapScript({
        claimFile: path.join(tmp, "claim.json"),
        outputFile: path.join(tmp, "output.txt"),
        claimSummaryFile: path.join(tmp, "summary.json"),
        stepId: "step-123",
        workdir: tmp,
      });
      assert.match(bootstrap, /SCOPE_RETRY_RULE=First remove\/rework out-of-scope files or shell-created project artifacts/);
      assert.match(bootstrap, /do not read retry worktree patches/i);
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

  it("keeps reviewer visual blocker evidence compact without screenshot artifact paths", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-reviewer-visual-summary-"));
    try {
      const workdir = path.join(tmp, "work");
      fs.mkdirSync(path.join(workdir, ".setfarm", "supervisor", "run-123"), { recursive: true });
      fs.writeFileSync(path.join(workdir, ".setfarm", "supervisor", "run-123", "SUPERVISOR_STATE.json"), JSON.stringify({
        schema: "setfarm.supervisor-state.v1",
        runId: "run-123",
        projectStatus: "blocked",
        updatedAt: "2026-05-17T00:00:00.000Z",
        stories: {
          "US-003": {
            status: "blocked",
            openBlockers: ["visual:dead-control-desktop-root-start"],
            warnings: [],
            resolved: [],
            lastEvidenceAt: "2026-05-17T00:00:00.000Z",
          },
        },
        evidence: {
          "visual:dead-control-desktop-root-start": {
            itemId: "visual:dead-control-desktop-root-start",
            storyId: "US-003",
            status: "dead-control",
            severity: "blocker",
            observed: ["Start button timeout with long Playwright call log that should not be copied into reviewer prompt"],
            lastScan: "visual-qa",
            files: [".setfarm/supervisor/run-123/visual/desktop-root-control-1.png"],
            message: "Visual QA dead_control on desktop /: Start: TimeoutError: locator.click timed out",
            checkedAt: "2026-05-17T00:00:00.000Z",
          },
        },
        interventions: [],
      }, null, 2));

      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "reviewer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "run-123",
        workdir,
        repo: workdir,
        storyId: "US-003",
        input: [
          "TASK: verify one story PR",
          `WORKDIR: ${workdir}`,
          "CURRENT STORY: Story US-003: Settings",
        ].join("\n"),
      });

      const blocker = (summary.supervisorEvidence as any).blockers[0];
      assert.equal((summary.supervisorEvidence as any).counts.blockers, 1);
      assert.equal(blocker.file, undefined);
      assert.deepEqual(blocker.observed, []);
      assert.doesNotMatch(JSON.stringify(summary.supervisorEvidence), /desktop-root-control-1\.png/);
      assert.match(String((summary.supervisorEvidence as any).instruction), /do not open screenshot\/image artifacts/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("turns visual QA supervisor retries into first-delta discipline", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-visual-qa-retry-summary-"));
    try {
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/screens/GameSettings.tsx\nsrc/App.tsx\n");
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
        storyId: "US-003",
        input: [
          "TASK: Project: VectorGate Lite",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story US-003: Game Settings",
          "",
          "## Previous Failure / Retry Feedback",
          "LLM_SUPERVISOR_BLOCKED: Treat this as manager feedback.",
          "SUPERVISOR_VISUAL_QA_BLOCKED: US-003",
          "- [blocker] layout_overflow mobile /: div DIV width=342 left=195 right=537",
          "",
          "## Current Story",
        ].join("\n"),
      });

      assert.equal(summary.failureCategory, "LLM_SUPERVISOR_BLOCKED");
      assert.equal((summary.retryFeedback as any).mode, "fix");
      assert.equal((summary.retryDiscipline as any).mode, "first-delta");
      assert.match(String((summary.retryDiscipline as any).instruction), /reported blocker/);
      assert.match(String((summary.retryDiscipline as any).instruction), /before broad analysis\/build\/test/);
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

  it("extracts QA-FIX story ids and titles from current story text", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-qafix-summary-"));
    try {
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "eab427d1-4405-4c7c-98bb-58c524f2dac8",
        workdir: tmp,
        repo: tmp,
        storyId: "QA-FIX-001",
        input: [
          "TASK: Project: ClinicPulse",
          `WORKDIR: ${tmp}`,
          "CURRENT STORY: Story QA-FIX-001: QA fix - supervise runtime failures",
          "",
          "Acceptance Criteria:",
          "1. Fix every failure listed in the QA/final failure report.",
        ].join("\n"),
      });

      assert.equal(summary.storyId, "QA-FIX-001");
      assert.equal(summary.storyTitle, "QA fix - supervise runtime failures");
      assert.match(String(summary.currentStory), /Story QA-FIX-001: QA fix/);
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
        "",
        "If blocked:",
        "",
        "STATUS: retry",
        "SUPERVISOR_DECISION: block",
        "SUPERVISOR_MEMORY_APPEND: <durable blocker>",
        "ISSUES: <blocking issue>",
      ].join("\n"),
    });

    assert.match(String((summary.outputContract as any)?.format), /SUPERVISOR_DECISION: pass/);
    assert.deepEqual((summary.outputContract as any)?.requiredFields.slice(0, 2), ["STATUS", "SUPERVISOR_DECISION"]);
    assert.deepEqual((summary.outputContract as any)?.requiredFields, [
      "STATUS",
      "SUPERVISOR_DECISION",
      "SUPERVISOR_MEMORY_APPEND",
      "CHECKS",
      "CHANGES",
      "RISKS",
    ]);
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

  it("extracts story diff base into supervisor claim summaries", () => {
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
      storyId: "US-002",
      input: [
        "SUPERVISOR_SCOPE: story",
        "STORY_BRANCH: abc12345-us-002",
        "STORY_DIFF_BASE: main",
        "CURRENT_STORY: Story US-002: Customer operations",
      ].join("\n"),
    });

    assert.equal((summary as any).storyDiffBase, "main");
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

  it("carries recoverable setup quality warnings into claim summaries", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-summary-quality-warnings-"));
    try {
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "supervisor",
        claimFile: "/tmp/claim.json",
        outputFile: "/tmp/output.txt",
        bootstrapFile: "/tmp/bootstrap.sh",
        stepId: "step-123",
        runId: "33d23f10-f68c-4c75-a9e9-4a48996d075b",
        workdir: tmp,
        repo: tmp,
        input: {
          task: "Project: quality warning sensor",
          context: {
            setup_quality_warnings: [
              "DESIGN_ICON_FALLBACK_WARNING: build-safe fallback used; route to supervisor before final acceptance.",
            ],
          },
        },
      });

      assert.deepEqual(
        (summary.setupQualityWarnings as { warnings: string[] }).warnings,
        ["DESIGN_ICON_FALLBACK_WARNING: build-safe fallback used; route to supervisor before final acceptance."],
      );
      assert.match(
        (summary.setupQualityWarnings as { instruction: string }).instruction,
        /Do not fail setup-build/,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
