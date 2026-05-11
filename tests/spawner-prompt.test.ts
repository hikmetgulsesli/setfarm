import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  buildResolvedClaimBootstrapScript,
  buildPreclaimedPrompt,
} from "../dist/spawner-prompt.js";

describe("spawner prompt bootstrap", () => {
  it("emits a copy-safe first exec command instead of an inline jq shell blob", () => {
    const prompt = buildPreclaimedPrompt({
      wfId: "feature-dev",
      role: "developer",
      claimFile: "/tmp/claim-feature-dev_developer-spawner-test.json",
      outputFile: "/tmp/setfarm-output-feature-dev_developer-spawner-test.txt",
      bootstrapFile: "/tmp/setfarm-claim-bootstrap-feature-dev_developer-spawner-test.sh",
    });

    assert.match(prompt, /First exec command:\nbash '\/tmp\/setfarm-claim-bootstrap-feature-dev_developer-spawner-test\.sh'/);
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
      fs.writeFileSync(bootstrapFile, buildResolvedClaimBootstrapScript({
        claimFile,
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
      assert.match(out, /Project: bootstrap sensor/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
