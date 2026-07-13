import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, it } from "node:test";

import {
  captureShadowSourceRevision,
  createShadowAttemptRecorder,
  initializeShadowAttemptRuntime,
  observeShadowAttemptClaim,
  toShadowStructuredObservation,
} from "../../src/execution/shadow-attempt-recorder.js";
import type { ExecutionAttemptV1 } from "../../src/execution/schemas/execution-attempt-v1.js";
import { resolveProductArtifactDir } from "../../src/runtime-config.js";
import { HASH_A, HASH_B, SHA_A, TREE_A } from "./fixtures.js";

const roots: string[] = [];

function attempt(overrides: Partial<ExecutionAttemptV1> = {}): ExecutionAttemptV1 {
  return {
    schema: "setfarm.execution-attempt.v1",
    attemptId: "ATT_018f0000-0000-7000-8000-000000000001",
    runId: "run-shadow",
    stepId: "implement",
    storyId: "US-001",
    generation: 1,
    fenceToken: HASH_A,
    attemptClass: "product_implementation",
    compilationReportHash: HASH_B,
    sourceBefore: { sha: SHA_A, treeHash: TREE_A },
    role: "developer",
    agentId: "feature-dev",
    branch: "story/us-001",
    worktree: ".worktrees/us-001",
    lease: {
      acquiredAt: "2026-07-12T00:00:00.000Z",
      expiresAt: "2026-07-12T06:00:00.000Z",
      heartbeatAt: "2026-07-12T00:00:00.000Z",
    },
    disposition: "claimed",
    evidenceRefs: ["setfarm://claim-log/41"],
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("shadow attempt recorder", () => {
  it("returns before dependency construction in unset and legacy modes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-shadow-legacy-"));
    roots.push(root);
    const artifactDir = path.join(root, "artifacts", "sha256");
    let constructions = 0;
    for (const runId of ["legacy-old", "legacy-new"]) {
      const initialized = await initializeShadowAttemptRuntime(runId, {
        readProtocol: async () => ({
          mode: "legacy",
          version: 1,
          compilerReleaseSha: null,
          packetHash: null,
          activationPreflightHash: null,
        }),
        createRuntime: async () => {
          constructions += 1;
          throw new Error("must not construct");
        },
      });
      assert.deepEqual(initialized, { mode: "legacy" });
    }
    assert.equal(constructions, 0);
    assert.equal(resolveProductArtifactDir({ SETFARM_PRODUCT_ARTIFACT_DIR: artifactDir }), artifactDir);
    await assert.rejects(access(artifactDir));
  });

  it("fails closed at explicit initialization for unknown and v3 modes", async () => {
    await assert.rejects(
      initializeShadowAttemptRuntime("run-v3", {
        readProtocol: async () => ({
          mode: "v3",
          version: 1,
          compilerReleaseSha: "a".repeat(40),
          packetHash: null,
          activationPreflightHash: "b".repeat(64),
        }),
      }),
      (error: any) => error?.code === "SHADOW_RUNTIME_V3_UNAVAILABLE",
    );
  });

  it("uses the stored run protocol even when the process default changes", async () => {
    let constructions = 0;
    process.env.SETFARM_PROTOCOL = "legacy";
    try {
      const initialized = await initializeShadowAttemptRuntime("run-shadow", {
        readProtocol: async () => ({
          mode: "shadow",
          version: 1,
          compilerReleaseSha: "a".repeat(40),
          packetHash: null,
          activationPreflightHash: "b".repeat(64),
        }),
        createRuntime: async () => {
          constructions += 1;
          return {} as never;
        },
      });
      assert.equal(initialized.mode, "shadow");
      assert.equal(constructions, 1);
    } finally {
      delete process.env.SETFARM_PROTOCOL;
    }
  });

  it("reserves exact branch, worktree, and source-before identity without prose", async () => {
    const reservations: any[] = [];
    const events: any[] = [];
    const recorder = createShadowAttemptRecorder({
      repository: {
        reserve: async (input) => {
          reservations.push(input);
          return { status: "reserved" as const, attempt: attempt() };
        },
        findActive: async () => undefined,
        complete: async () => ({ status: "stale_fence" as const }),
      },
      resolveCompilationReportHash: async () => HASH_B,
      emit: (event) => events.push(event),
    });

    const result = await recorder.observeClaim({
      runId: "run-shadow",
      stepId: "implement",
      storyId: "US-001",
      legacyClaimId: 41,
      legacyClaimGeneration: 7,
      role: "developer",
      agentId: "feature-dev",
      branch: "story/us-001",
      worktree: ".worktrees/us-001",
      sourceBefore: { sha: SHA_A, treeHash: TREE_A },
    });
    assert.equal(result.status, "observed");
    assert.deepEqual(reservations[0], {
      runId: "run-shadow",
      stepId: "implement",
      storyId: "US-001",
      attemptClass: "product_implementation",
      compilationReportHash: HASH_B,
      sourceBefore: { sha: SHA_A, treeHash: TREE_A },
      role: "developer",
      agentId: "feature-dev",
      branch: "story/us-001",
      worktree: ".worktrees/us-001",
      evidenceRefs: [
        "setfarm://claim-log/41",
        "setfarm://claim-generation/7",
      ],
    });
    assert.equal(JSON.stringify(reservations).includes("prose"), false);
    assert.equal(events[0]?.code, "ATTEMPT_RESERVED");
    assert.equal(events[0]?.legacyClaimId, 41);
  });

  it("turns repository failures and duplicate/stale outcomes into bounded observations", async () => {
    const events: any[] = [];
    const recorder = createShadowAttemptRecorder({
      repository: {
        reserve: async () => {
          throw new Error(
            "database exploded postgresql://private:secret@host/db /Users/private/payload token=abc123",
          );
        },
        findActive: async () => attempt(),
        complete: async () => ({ status: "stale_fence" as const }),
      },
      resolveCompilationReportHash: async () => HASH_B,
      emit: (event) => events.push(event),
    });
    const failed = await recorder.observeClaim({
      runId: "run-shadow",
      stepId: "implement",
      storyId: "US-001",
      legacyClaimId: 42,
      legacyClaimGeneration: 1,
      role: "developer",
      branch: "story/us-001",
      worktree: ".worktrees/us-001",
      sourceBefore: { sha: SHA_A, treeHash: TREE_A },
    });
    assert.equal(failed.status, "shadow_error");
    assert.equal(events.at(-1)?.event, "product_compiler.shadow_error");
    assert.ok((events.at(-1)?.message.length ?? 0) <= 500);
    assert.doesNotMatch(
      events.at(-1)?.message ?? "",
      /private:secret|\/Users\/private|abc123/,
    );

    const success = await recorder.observeSuccess({
      runId: "run-shadow",
      stepId: "implement",
      storyId: "US-001",
      sourceAfter: { sha: SHA_A, treeHash: TREE_A },
      evidenceRefs: [],
    });
    assert.deepEqual(success, { status: "observed", code: "ATTEMPT_STALE_FENCE" });
  });

  it("projects machine-readable observation evidence without making shadow authoritative", () => {
    const projected = toShadowStructuredObservation({
      event: "product_compiler.shadow_observation",
      code: "ATTEMPT_RESERVED",
      message: "Shadow claim observation: reserved",
      runId: "run-shadow",
      stepId: "implement",
      storyId: "US-001",
      attemptId: "ATT_018f0000-0000-7000-8000-000000000001",
      legacyClaimId: 41,
      attemptLegacyClaimId: 41,
      attemptDisposition: "claimed",
    }, new Date("2026-07-13T00:00:00.000Z"));
    assert.equal(projected.status, "pass");
    assert.deepEqual(projected.evidence, {
      schema: "setfarm.shadow-attempt-observation.v1",
      code: "ATTEMPT_RESERVED",
      attemptId: "ATT_018f0000-0000-7000-8000-000000000001",
      legacyClaimId: 41,
      attemptLegacyClaimId: 41,
      attemptDisposition: "claimed",
    });
    assert.deepEqual(projected.metadata, { protocol: "shadow", authoritative: false });
    assert.equal(projected.completedAt, "2026-07-13T00:00:00.000Z");

    const anomaly = toShadowStructuredObservation({
      event: "product_compiler.shadow_observation",
      code: "ATTEMPT_ACTIVE_CONFLICT",
      message: "Shadow claim observation: active_conflict",
      runId: "run-shadow",
      stepId: "implement",
      storyId: "US-001",
    }, new Date("2026-07-13T00:00:00.000Z"));
    assert.equal(anomaly.status, "fail");
  });

  it("bounds a hanging observation sink without changing the shadow result", async () => {
    const recorder = createShadowAttemptRecorder({
      repository: {
        reserve: async () => ({
          status: "reserved" as const,
          attempt: attempt({ evidenceRefs: ["setfarm://claim-log/44"] }),
        }),
        findActive: async () => undefined,
        complete: async () => ({ status: "stale_fence" as const }),
      },
      resolveCompilationReportHash: async () => HASH_B,
      emit: async () => await new Promise<void>(() => {}),
      emitTimeoutMs: 10,
    });
    const startedAt = Date.now();
    const result = await recorder.observeClaim({
      runId: "run-shadow",
      stepId: "implement",
      storyId: "US-001",
      legacyClaimId: 44,
      legacyClaimGeneration: 1,
      role: "developer",
      branch: "story/us-001",
      worktree: ".worktrees/us-001",
      sourceBefore: { sha: SHA_A, treeHash: TREE_A },
    });
    assert.equal(result.status, "observed");
    assert.ok(Date.now() - startedAt < 250);
  });

  it("captures clean Git tree identity and changes the fingerprint for dirty source", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-shadow-source-"));
    roots.push(root);
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
    await writeFile(path.join(root, "app.txt"), "one\n", "utf8");
    execFileSync("git", ["add", "app.txt"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "init"], { cwd: root });
    const clean = await captureShadowSourceRevision(root);
    assert.match(clean.sha, /^[a-f0-9]{40}$/);
    assert.match(clean.treeHash, /^[a-f0-9]{64}$/);

    execFileSync("git", ["update-index", "--assume-unchanged", "app.txt"], { cwd: root });
    await writeFile(path.join(root, "app.txt"), "two\n", "utf8");
    const assumedChanged = await captureShadowSourceRevision(root);
    assert.notEqual(assumedChanged.treeHash, clean.treeHash);

    await writeFile(path.join(root, "new.txt"), "untracked\n", "utf8");
    const dirty = await captureShadowSourceRevision(root);
    assert.equal(dirty.sha, clean.sha);
    assert.match(dirty.treeHash, /^[a-f0-9]{64}$/);
    assert.notEqual(dirty.treeHash, clean.treeHash);
    assert.notEqual(dirty.treeHash, assumedChanged.treeHash);
    assert.equal(await readFile(path.join(root, "new.txt"), "utf8"), "untracked\n");
  });

  it("safe runtime hook preserves legacy result when shadow construction fails", async () => {
    const diagnostics: any[] = [];
    const result = await observeShadowAttemptClaim({
      runId: "run-shadow",
      stepId: "implement",
      storyId: "US-001",
      legacyClaimId: 43,
      legacyClaimGeneration: 1,
      role: "developer",
      branch: "story/us-001",
      worktree: ".worktrees/us-001",
    }, {
      readProtocol: async () => ({
        mode: "shadow",
        version: 1,
        compilerReleaseSha: "a".repeat(40),
        packetHash: null,
        activationPreflightHash: "b".repeat(64),
      }),
      createRuntime: async () => { throw new Error("compiler failed"); },
      onDiagnostic: (event) => diagnostics.push(event),
    });
    assert.equal(result.status, "shadow_error");
    assert.equal(diagnostics[0]?.event, "product_compiler.shadow_error");
  });
});
