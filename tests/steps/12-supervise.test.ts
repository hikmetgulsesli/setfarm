import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ParsedOutput } from "../../src/installer/steps/types.js";
import { superviseModule } from "../../src/installer/steps/12-supervise/module.js";
import { normalizeOutput, onComplete, validateOutput } from "../../src/installer/steps/12-supervise/guards.js";
import { readSupervisorState, supervisorStatePath, writeSupervisorState } from "../../src/installer/supervisor/state.js";

describe("12-supervise step module", () => {
  it("module metadata is correct", () => {
    assert.equal(superviseModule.id, "supervise");
    assert.equal(superviseModule.type, "single");
    assert.equal(superviseModule.agentRole, "supervisor");
    assert.deepEqual(superviseModule.requiredOutputFields, ["STATUS", "SUPERVISOR_DECISION", "AC_COVERAGE"]);
  });

  it("normalizes done supervisor audit outputs that omit the decision label", () => {
    const parsed = {
      status: "done",
      audit_result: "Previous blocker is not currently reproduced; git status is clean.",
      ac_coverage: "checked 2/2 acceptance criteria with file and command evidence",
      checks: "npm run build passed; npm run test:run passed",
    } as ParsedOutput;

    normalizeOutput(parsed);

    assert.equal(parsed.supervisor_decision, "pass");
    assert.equal(validateOutput(parsed).ok, true);
  });

  it("keeps explicit supervisor decisions unchanged", () => {
    const parsed = {
      status: "done",
      supervisor_decision: "fixed",
      ac_coverage: "checked 3/3 acceptance criteria after scoped fix",
      changes: "Adjusted scoped source.",
    } as ParsedOutput;

    normalizeOutput(parsed);

    assert.equal(parsed.supervisor_decision, "fixed");
    assert.equal(validateOutput(parsed).ok, true);
  });

  it("rejects invalid supervisor decisions", () => {
    const result = validateOutput({
      status: "done",
      supervisor_decision: "ok",
    } as ParsedOutput);

    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /SUPERVISOR_DECISION must be pass, fixed, or block/);
  });

  it("rejects pass or fixed decisions without acceptance-criteria coverage", () => {
    const passResult = validateOutput({
      status: "done",
      supervisor_decision: "pass",
      checks: "npm run build passed",
    } as ParsedOutput);
    assert.equal(passResult.ok, false);
    assert.match(passResult.errors.join("\n"), /AC_COVERAGE is required/);

    const fixedResult = validateOutput({
      status: "done",
      supervisor_decision: "fixed",
      changes: "Scoped patch",
    } as ParsedOutput);
    assert.equal(fixedResult.ok, false);
    assert.match(fixedResult.errors.join("\n"), /AC_COVERAGE is required/);
  });

  it("buildPrompt passes the full current story acceptance criteria to the supervisor", () => {
    const prompt = superviseModule.buildPrompt({
      runId: "run-supervisor-story",
      task: "Build a puzzle game.",
      context: {
        repo: "/tmp/project",
        story_workdir: "/tmp/project/.setfarm/story-worktree",
        supervisor_scope: "story",
        current_story_id: "US-001",
        current_story_title: "Game runtime",
        current_story: [
          "Story US-001: Game runtime",
          "",
          "Build the runtime state bridge.",
          "",
          "Acceptance Criteria:",
          "  1. Expose storage status and last error through window.app.",
          "  2. Disable gameplay controls when the game is not playing.",
        ].join("\n"),
      },
    });

    assert.match(prompt, /Story US-001: Game runtime/);
    assert.match(prompt, /Expose storage status and last error through window\.app/);
    assert.match(prompt, /Disable gameplay controls when the game is not playing/);
  });

  it("buildPrompt carries the story write scope into supervisor checkpoints", () => {
    const prompt = superviseModule.buildPrompt({
      runId: "run-supervisor-scope",
      task: "Build a puzzle game.",
      context: {
        repo: "/tmp/project",
        story_workdir: "/tmp/project/.setfarm/story-worktree",
        supervisor_scope: "story",
        current_story_id: "US-002",
        current_story_title: "Menu wiring",
        story_scope_files: "src/App.tsx, src/hooks/useAppState.ts",
        story_shared_files: "src/screens/MainMenuMenu.tsx",
        scope_reminder: "SCOPE ENFORCEMENT: You may ONLY write files in [src/App.tsx, src/hooks/useAppState.ts].",
      },
    });

    assert.match(prompt, /SCOPE_FILES: src\/App\.tsx, src\/hooks\/useAppState\.ts/);
    assert.match(prompt, /SHARED_FILES: src\/screens\/MainMenuMenu\.tsx/);
    assert.match(prompt, /supervisor's safe\s+write set/i);
    assert.match(prompt, /SCOPE ENFORCEMENT: You may ONLY write files/);
  });

  it("buildPrompt tells story supervisors which base branch to use for scope diffs", () => {
    const prompt = superviseModule.buildPrompt({
      runId: "run-supervisor-diff-base",
      task: "Build a returns desk.",
      context: {
        repo: "/tmp/project",
        story_workdir: "/tmp/project/.setfarm/story-worktree",
        supervisor_scope: "story",
        current_story_id: "US-002",
        current_story_title: "Customer operations",
        story_branch: "abc12345-us-002",
        story_diff_base: "main",
        story_scope_files: "src/App.tsx",
      },
    });

    assert.match(prompt, /STORY_DIFF_BASE: main/);
    assert.match(prompt, /git diff --name-status STORY_DIFF_BASE\.\.\.HEAD/);
    assert.match(prompt, /Do not compare a story PR\s+against an older workflow feature baseline/i);
  });

  it("prompt requires bounded browser checks on isolated strict ports", () => {
    const prompt = superviseModule.buildPrompt({
      runId: "run-supervisor-browser",
      task: "Build a browser game.",
      context: { repo: "/tmp/project", supervisor_scope: "story" },
    });

    assert.match(prompt, /--strictPort/);
    assert.match(prompt, /timeout 12s agent-browser/);
    assert.match(prompt, /3080,\s*3333,\s*5173,\s*or 5600/);
  });

  it("buildPrompt tells supervisors to keep generated screen feedback in-surface without breaking flex mounts", () => {
    const prompt = superviseModule.buildPrompt({
      runId: "run-supervisor-generated-screen",
      task: "Build an operations console.",
      context: {
        repo: "/tmp/project",
        story_workdir: "/tmp/project/.setfarm/story-worktree",
        supervisor_scope: "story",
        current_story_id: "US-002",
        current_story_title: "Generated screen wiring",
        story_scope_files: "src/App.tsx, src/screens/Operations.tsx",
      },
    });

    assert.match(prompt, /do not add visible app-shell diagnostic\/status\/persistence panels/i);
    assert.match(prompt, /owned Product Surface\/generated screen props\/state/);
    assert.match(prompt, /window\.app`\/`globalThis\.app/);
    assert.match(prompt, /neutral flex mount/);
    assert.match(prompt, /flex min-h-screen w-full/);
    assert.match(prompt, /Do not fix shell chrome by breaking the generated screen's required root layout/);
  });

  it("rejects story supervisor pass when AC_COVERAGE does not match the current story criteria", async () => {
    await assert.rejects(
      () => onComplete({
        runId: "run-supervisor-story",
        stepId: "supervise",
        parsed: {
          status: "done",
          supervisor_decision: "pass",
          ac_coverage: "checked 7/7 task requirements; playable board and controls exist",
        },
        context: {
          supervisor_scope: "story",
          current_story: [
            "Story US-001: Game runtime",
            "",
            "Acceptance Criteria:",
            "  1. Expose storage status and last error through window.app.",
            "  2. Disable gameplay controls when the game is not playing.",
          ].join("\n"),
        },
      }),
      /SUPERVISOR_AC_COVERAGE_MISMATCH|SUPERVISOR_AC_COVERAGE_GENERIC/,
    );
  });

  it("accepts complete story-specific coverage with a stale denominator as a warning", async () => {
    const context: Record<string, any> = {
      supervisor_scope: "story",
      current_story: [
        "Story US-001: Game runtime",
        "",
        "Acceptance Criteria:",
        "  1. Expose storage status and last error through window.app.",
        "  2. Disable gameplay controls when the game is not playing.",
        "  3. Keep timers paused outside gameplay.",
      ].join("\n"),
    };

    await onComplete({
      runId: "run-supervisor-story",
      stepId: "supervise",
      parsed: {
        status: "done",
        supervisor_decision: "pass",
        ac_coverage: "checked 2/2 acceptance criteria; storage, disabled controls, and timer behavior were audited in source and tests",
      },
      context,
    });

    assert.match(context.supervisor_coverage_warning, /reported 2\/2, current story has 3/);
  });

  it("clears durable story supervisor blockers after a story-scoped pass", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervise-pass-"));
    try {
      const runId = "run-supervisor-story-state";
      writeSupervisorState(tmp, {
        schema: "setfarm.supervisor-state.v1",
        runId,
        projectStatus: "blocked",
        updatedAt: "2026-05-24T00:00:00.000Z",
        stories: {
          "US-002": {
            status: "blocked",
            openBlockers: ["visual:navigation_error-mobile-root"],
            warnings: [],
            resolved: [],
            lastEvidenceAt: "2026-05-24T00:00:00.000Z",
          },
        },
        evidence: {
          "visual:navigation_error-mobile-root": {
            itemId: "visual:navigation_error-mobile-root",
            storyId: "US-002",
            status: "visual-failure",
            severity: "blocker",
            observed: ["page.goto: Target page, context or browser has been closed"],
            lastScan: "visual-qa",
            files: [],
            message: "Visual QA navigation_error on mobile /",
            checkedAt: "2026-05-24T00:00:00.000Z",
          },
        },
        interventions: [],
      });
      assert.equal(fs.existsSync(supervisorStatePath(tmp, runId)), true);

      await onComplete({
        runId,
        stepId: "supervise",
        parsed: {
          status: "done",
          supervisor_decision: "pass",
          ac_coverage: "checked 1/1 acceptance criteria; mobile route renders and prior visual infra failure did not reproduce",
          checks: "npm run build passed",
        },
        context: {
          supervisor_scope: "story",
          current_story_id: "US-002",
          story_workdir: tmp,
          current_story: [
            "Story US-002: Vehicle editor",
            "",
            "Acceptance Criteria:",
            "  1. Mobile route renders without navigation errors.",
          ].join("\n"),
        },
      });

      const state = readSupervisorState(tmp, runId);
      assert.equal(state.projectStatus, "implementing");
      assert.equal(state.stories["US-002"].status, "passed");
      assert.deepEqual(state.stories["US-002"].openBlockers, []);
      assert.equal(state.evidence["visual:navigation_error-mobile-root"].status, "passed");
      assert.equal(state.evidence["llm-supervisor:US-002:decision"].status, "passed");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects incomplete story-scoped coverage", async () => {
    await assert.rejects(
      () => onComplete({
        runId: "run-supervisor-story",
        stepId: "supervise",
        parsed: {
          status: "done",
          supervisor_decision: "pass",
          ac_coverage: "checked 1/2 acceptance criteria; storage was audited",
        },
        context: {
          supervisor_scope: "story",
          current_story: [
            "Story US-001: Game runtime",
            "",
            "Acceptance Criteria:",
            "  1. Expose storage status and last error through window.app.",
            "  2. Disable gameplay controls when the game is not playing.",
          ].join("\n"),
        },
      }),
      /SUPERVISOR_AC_COVERAGE_INCOMPLETE/,
    );
  });
});
