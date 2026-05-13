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
    assert.match(prompt, /Do NOT parse or dump claim\.input with jq\/sed\/head\/node loops/);
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
        generatedScreenPolicy: {
          summary: "No generated screen source file is in scope.",
        },
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
      assert.match(out, /GENERATED_SCREEN_POLICY=No generated screen source file is in scope/);
      assert.match(out, /Project: bootstrap sensor/);
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
      fs.writeFileSync(path.join(workdir, "src", "screens", "SCREEN_INDEX.json"), JSON.stringify([
        { file: "src/screens/MainMenu.tsx" },
        { file: "src/screens/GameBoard.tsx" },
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
      assert.deepEqual(summary.scopeFiles, ["src/App.tsx", "src/state.ts"]);
      assert.deepEqual((summary.generatedScreenPolicy as any).allowedSourceFiles, []);
      assert.deepEqual((summary.generatedScreenPolicy as any).forbiddenSourceFiles, [
        "src/screens/GameBoard.tsx",
        "src/screens/MainMenu.tsx",
      ]);
      assert.match((summary.generatedScreenPolicy as any).summary, /No generated screen source file is in scope/);
      assert.match(String(summary.acceptanceCriteria), /Pieces fall and rotate/);
      assert.match(JSON.stringify(summary.handoff), /Audit fallback only/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
