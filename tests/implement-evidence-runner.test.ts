import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  normalizeInteractionRequests,
  runImplementEvidenceIfRequested,
} from "../dist/installer/implement-evidence-runner.js";
import { implementEvidenceArtifactPaths } from "../dist/installer/implement-evidence.js";

const ENV_KEYS = ["SETFARM_IMPLEMENT_EVIDENCE_GATE", "SETFARM_VISUAL_EVIDENCE_GATE"];
const savedEnv = new Map<string, string | undefined>();

describe("implement evidence runner", () => {
  beforeEach(() => {
    savedEnv.clear();
    for (const key of ENV_KEYS) {
      savedEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  it("normalizes UI contract actionId shorthand into browser click interactions", () => {
    const interactions = normalizeInteractionRequests([
      { actionId: "start-game-4", target: "GameplayVectordriftLite", description: "Start the game" },
      { id: "pause-flow", action: "pause", actionId: "pause-2", target: "GameplayVectordriftLite" },
      { id: "settings", action: "click", target: "[data-action-id='settings-2']" },
      "Open settings",
      {},
    ]);

    assert.deepEqual(interactions, [
      {
        id: "start-game-4",
        action: "click",
        target: '[data-action-id="start-game-4"]',
        waitCondition: "dom_idle",
        timeoutMs: 1000,
      },
      {
        id: "pause-flow",
        action: "click",
        target: '[data-action-id="pause-2"]',
        waitCondition: "dom_idle",
        timeoutMs: 1000,
      },
      {
        id: "settings",
        action: "click",
        target: "[data-action-id='settings-2']",
        value: undefined,
        waitCondition: undefined,
        timeoutMs: undefined,
      },
    ]);
  });

  it("adds current surface and available action ids to failed interaction context", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/implement-evidence-runner.ts"), "utf-8");
    assert.match(source, /function failedInteractionContext/);
    assert.match(source, /currentScreen=/);
    assert.match(source, /availableActionIds=/);
    assert.match(source, /missingTargetActionId=/);
    assert.match(source, /target is not present in the current runtime surface/);
    assert.match(source, /actionIdsFromDomSnapshot\(capture\?\.domSnapshotPath\)/);
    assert.match(source, /stateBridgeScreen\(capture\?\.stateBridge\)/);
  });

  it("classifies runtime capture infrastructure failures with stack-owned failure metadata", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/implement-evidence-runner.ts"), "utf-8");
    assert.match(source, /classifyStackFailure/);
    assert.match(source, /failureOwner: failureClassification\?\.owner/);
    assert.match(source, /failureAction: failureClassification\?\.action/);
    assert.match(source, /failureCategory: failureClassification\?\.category/);
  });

  afterEach(() => {
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("does not run when no verification request exists in advisory mode", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-evidence-runner-no-request-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "advisory";
      const result = await runImplementEvidenceIfRequested({
        runId: "run-1",
        storyId: "US-001",
        workdir: tmp,
      });
      assert.equal(result.attempted, false);
      assert.equal(result.ok, true);
      assert.match(result.reason, /No implementation verification request/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks when a verification request exists but no preview script is available in blocking mode", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-evidence-runner-no-preview-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ scripts: { build: "node -e \"0\"" } }));
      const paths = implementEvidenceArtifactPaths(tmp, "US-001");
      fs.mkdirSync(path.dirname(paths.request), { recursive: true });
      fs.writeFileSync(paths.request, JSON.stringify({
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: [],
        uncoveredCriteria: [],
        knownGaps: [],
      }));

      const result = await runImplementEvidenceIfRequested({
        runId: "run-1",
        storyId: "US-001",
        workdir: tmp,
      });
      assert.equal(result.attempted, false);
      assert.equal(result.ok, false);
      assert.match(result.reason, /No package preview script/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
