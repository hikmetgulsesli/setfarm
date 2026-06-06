import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  implementEvidenceArtifactPaths,
  readImplementEvidenceConfig,
  summarizeImplementEvidenceValidation,
  validateImplementEvidenceArtifacts,
} from "../dist/installer/implement-evidence.js";
import {
  currentVisualEvidenceResult,
  writeImplementEvidenceArtifact,
} from "../dist/installer/implement-evidence-writer.js";

const ENV_KEYS = [
  "SETFARM_IMPLEMENT_EVIDENCE_GATE",
  "SETFARM_VISUAL_EVIDENCE_GATE",
  "SETFARM_VISUAL_EVIDENCE_PROVIDER",
];

const savedEnv = new Map<string, string | undefined>();

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

describe("implement evidence contract", () => {
  beforeEach(() => {
    savedEnv.clear();
    for (const key of ENV_KEYS) {
      savedEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("defaults implementation evidence to blocking and visual evidence to off", () => {
    const config = readImplementEvidenceConfig();
    assert.equal(config.mode, "blocking");
    assert.equal(config.visualGate, "off");
    assert.equal(config.visualProvider, "none");
  });

  it("parses explicit visual evidence gate env controls", () => {
    process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
    process.env.SETFARM_VISUAL_EVIDENCE_GATE = "advisory";
    process.env.SETFARM_VISUAL_EVIDENCE_PROVIDER = "minimax";

    const config = readImplementEvidenceConfig();
    assert.equal(config.mode, "blocking");
    assert.equal(config.visualGate, "advisory");
    assert.equal(config.visualProvider, "minimax");
  });

  it("reports missing artifacts in advisory mode without blocking", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-missing-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "advisory";
      const result = validateImplementEvidenceArtifacts(tmp, "US-001");
      assert.equal(result.ok, true);
      assert.deepEqual(result.missingArtifacts.sort(), ["evidence", "intent", "request"]);
      assert.match(summarizeImplementEvidenceValidation(result), /missing=evidence,intent,request|missing=intent,request,evidence/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks missing artifacts in blocking mode", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-block-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      const result = validateImplementEvidenceArtifacts(tmp, "US-001");
      assert.equal(result.ok, false);
      assert.deepEqual(result.missingArtifacts.sort(), ["evidence", "intent", "request"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("passes valid artifacts with disabled visual evidence", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-valid-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      process.env.SETFARM_VISUAL_EVIDENCE_GATE = "off";
      const paths = implementEvidenceArtifactPaths(tmp, "US-001");
      writeJson(paths.intent, {
        schema: "setfarm.implement-intent.v1",
        storyId: "US-001",
        storyType: "ui_interactive",
        acceptanceCriteria: [{ id: "AC-001", description: "Open settings" }],
        runtimeEvidenceRequired: { minFlowCount: 1 },
      });
      writeJson(paths.request, {
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: [{ action: "click", target: "[data-action-id='ACT_OPEN_SETTINGS']" }],
        uncoveredCriteria: [],
        knownGaps: [],
      });
      writeJson(paths.evidence, {
        schema: "setfarm.implement-evidence.v1",
        storyId: "US-001",
        runtime: { url: "http://127.0.0.1:6101", port: 6101 },
        commands: [{ cmd: "npm run build", exitCode: 0 }],
        flows: [{ flowId: "AC-001", screenshots: ["artifacts/settings.png"] }],
        visualEvidence: { status: "disabled" },
        verdict: "pass",
      });

      const result = validateImplementEvidenceArtifacts(tmp, "US-001");
      assert.equal(result.ok, true);
      assert.deepEqual(result.missingArtifacts, []);
      assert.deepEqual(result.issues, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects boolean runtimeEvidenceRequired instead of treating it as a valid contract", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-runtime-contract-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      const paths = implementEvidenceArtifactPaths(tmp, "US-001");
      writeJson(paths.intent, {
        schema: "setfarm.implement-intent.v1",
        storyId: "US-001",
        storyType: "browser-game",
        acceptanceCriteria: ["Runtime advances state"],
        runtimeEvidenceRequired: true,
      });
      writeJson(paths.request, {
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: [],
        uncoveredCriteria: [],
        knownGaps: [],
      });
      writeJson(paths.evidence, {
        schema: "setfarm.implement-evidence.v1",
        storyId: "US-001",
        runtime: { url: "http://127.0.0.1:6101", port: 6101 },
        commands: [],
        flows: [{ flowId: "initial", captures: [] }],
        visualEvidence: { status: "disabled" },
        verdict: "pass",
      });

      const result = validateImplementEvidenceArtifacts(tmp, "US-001");

      assert.equal(result.ok, false);
      assert.equal(result.issues.some((issue) => issue.code === "INTENT_RUNTIMEEVIDENCEREQUIRED_INVALID"), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects prose interactionRequests because Setfarm can only execute structured actions", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-prose-actions-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      const paths = implementEvidenceArtifactPaths(tmp, "US-001");
      writeJson(paths.intent, {
        schema: "setfarm.implement-intent.v1",
        storyId: "US-001",
        storyType: "browser-game",
        acceptanceCriteria: ["Settings opens"],
        runtimeEvidenceRequired: { minFlowCount: 0 },
      });
      writeJson(paths.request, {
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: ["Open settings"],
        uncoveredCriteria: [],
        knownGaps: [],
      });
      writeJson(paths.evidence, {
        schema: "setfarm.implement-evidence.v1",
        storyId: "US-001",
        runtime: { url: "http://127.0.0.1:6101", port: 6101 },
        commands: [],
        flows: [{ flowId: "initial", captures: [] }],
        visualEvidence: { status: "disabled" },
        verdict: "pass",
      });

      const result = validateImplementEvidenceArtifacts(tmp, "US-001");

      assert.equal(result.ok, false);
      assert.equal(result.issues.some((issue) => issue.code === "IMPLEMENT_VERIFICATION_REQUEST_INTERACTIONS_INVALID"), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects interactive acceptance criteria that are neither tested nor declared uncovered", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-untested-criteria-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      const paths = implementEvidenceArtifactPaths(tmp, "US-001");
      writeJson(paths.intent, {
        schema: "setfarm.implement-intent.v1",
        storyId: "US-001",
        storyType: "ui_interactive",
        acceptanceCriteria: [{ id: "AC-009", description: "Keyboard controls change gameplay state." }],
        runtimeEvidenceRequired: { minFlowCount: 0 },
      });
      writeJson(paths.request, {
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: [],
        uncoveredCriteria: [],
        knownGaps: [],
      });
      writeJson(paths.evidence, {
        schema: "setfarm.implement-evidence.v1",
        storyId: "US-001",
        runtime: { url: "http://127.0.0.1:6101", port: 6101 },
        commands: [],
        flows: [{ flowId: "initial", captures: [] }],
        visualEvidence: { status: "disabled" },
        verdict: "pass",
      });

      const result = validateImplementEvidenceArtifacts(tmp, "US-001");

      assert.equal(result.ok, false);
      assert.equal(result.issues.some((issue) => issue.code === "IMPLEMENT_VERIFICATION_REQUEST_UNTESTED_CRITERIA"), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts actionId interaction shorthand because Setfarm normalizes UI contract actions", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-action-id-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      const paths = implementEvidenceArtifactPaths(tmp, "US-001");
      writeJson(paths.intent, {
        schema: "setfarm.implement-intent.v1",
        storyId: "US-001",
        storyType: "browser-game",
        acceptanceCriteria: ["Start game"],
        runtimeEvidenceRequired: { minFlowCount: 1 },
      });
      writeJson(paths.request, {
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: [{ actionId: "start-game-4", target: "Gameplay" }],
        uncoveredCriteria: [],
        knownGaps: [],
      });
      writeJson(paths.evidence, {
        schema: "setfarm.implement-evidence.v1",
        storyId: "US-001",
        runtime: { url: "http://127.0.0.1:6101", port: 6101 },
        commands: [],
        flows: [{ flowId: "initial", captures: [] }, { flowId: "start-game-4", captures: [] }],
        visualEvidence: { status: "disabled" },
        verdict: "pass",
      });

      const result = validateImplementEvidenceArtifacts(tmp, "US-001");

      assert.equal(result.ok, true);
      assert.equal(result.issues.some((issue) => issue.code === "IMPLEMENT_VERIFICATION_REQUEST_INTERACTIONS_INVALID"), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects empty interaction objects because Setfarm cannot execute them", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-empty-action-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      const paths = implementEvidenceArtifactPaths(tmp, "US-001");
      writeJson(paths.intent, {
        schema: "setfarm.implement-intent.v1",
        storyId: "US-001",
        storyType: "browser-game",
        acceptanceCriteria: ["Start game"],
        runtimeEvidenceRequired: { minFlowCount: 0 },
      });
      writeJson(paths.request, {
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: [{}],
        uncoveredCriteria: [],
        knownGaps: [],
      });
      writeJson(paths.evidence, {
        schema: "setfarm.implement-evidence.v1",
        storyId: "US-001",
        runtime: { url: "http://127.0.0.1:6101", port: 6101 },
        commands: [],
        flows: [{ flowId: "initial", captures: [] }],
        visualEvidence: { status: "disabled" },
        verdict: "pass",
      });

      const result = validateImplementEvidenceArtifacts(tmp, "US-001");

      assert.equal(result.ok, false);
      assert.equal(result.issues.some((issue) => issue.code === "IMPLEMENT_VERIFICATION_REQUEST_INTERACTIONS_INVALID"), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks visual evidence when visual gate is blocking and visual status is not pass", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-visual-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      process.env.SETFARM_VISUAL_EVIDENCE_GATE = "blocking";
      const paths = implementEvidenceArtifactPaths(tmp, "US-001");
      writeJson(paths.intent, {
        schema: "setfarm.implement-intent.v1",
        storyId: "US-001",
        storyType: "ui_interactive",
        acceptanceCriteria: [],
        runtimeEvidenceRequired: {},
      });
      writeJson(paths.request, {
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: [],
        uncoveredCriteria: [],
        knownGaps: [],
      });
      writeJson(paths.evidence, {
        schema: "setfarm.implement-evidence.v1",
        storyId: "US-001",
        runtime: { url: "http://127.0.0.1:6101", port: 6101 },
        commands: [],
        flows: [],
        visualEvidence: { status: "disabled" },
        verdict: "pass",
      });

      const result = validateImplementEvidenceArtifacts(tmp, "US-001");
      assert.equal(result.ok, false);
      assert.equal(result.issues.some((issue) => issue.code === "VISUAL_EVIDENCE_BLOCKING_NOT_PASSED"), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("writes Setfarm-owned evidence artifacts with explicit disabled visual status", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-evidence-writer-"));
    try {
      process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
      process.env.SETFARM_VISUAL_EVIDENCE_GATE = "off";
      const paths = implementEvidenceArtifactPaths(tmp, "US-001");
      writeJson(paths.intent, {
        schema: "setfarm.implement-intent.v1",
        storyId: "US-001",
        storyType: "ui_interactive",
        acceptanceCriteria: [],
        runtimeEvidenceRequired: {},
      });
      writeJson(paths.request, {
        schema: "setfarm.implement-verification-request.v1",
        storyId: "US-001",
        status: "ready_for_orchestrator_verification",
        interactionRequests: [],
        uncoveredCriteria: [],
        knownGaps: [],
      });

      const evidencePath = writeImplementEvidenceArtifact({
        workdir: tmp,
        storyId: "US-001",
        runtime: {
          kind: "browser",
          sessionId: "session-1",
          workdir: tmp,
          host: "127.0.0.1",
          port: 6101,
          url: "http://127.0.0.1:6101",
          startedAt: new Date(0).toISOString(),
        },
        commands: [{ cmd: "npm run build", exitCode: 0 }],
        flows: [],
        verdict: "pass",
      });

      const artifact = JSON.parse(fs.readFileSync(evidencePath, "utf-8"));
      assert.equal(artifact.schema, "setfarm.implement-evidence.v1");
      assert.equal(artifact.visualEvidence.status, "disabled");
      assert.equal(artifact.visualEvidence.mode, "off");
      assert.equal(validateImplementEvidenceArtifacts(tmp, "US-001").ok, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps configured visual evidence visible even before a provider runner is attached", () => {
    process.env.SETFARM_VISUAL_EVIDENCE_GATE = "advisory";
    process.env.SETFARM_VISUAL_EVIDENCE_PROVIDER = "minimax";
    const visual = currentVisualEvidenceResult();
    assert.equal(visual.status, "skipped");
    assert.equal(visual.mode, "advisory");
    assert.equal(visual.provider, "minimax");
    assert.match(visual.summary, /no visual judgement runner/i);
  });
});
