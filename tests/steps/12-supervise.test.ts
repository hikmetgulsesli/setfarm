import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { ParsedOutput } from "../../src/installer/steps/types.js";
import { superviseModule } from "../../src/installer/steps/12-supervise/module.js";
import { normalizeOutput, onComplete, validateOutput } from "../../src/installer/steps/12-supervise/guards.js";

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
