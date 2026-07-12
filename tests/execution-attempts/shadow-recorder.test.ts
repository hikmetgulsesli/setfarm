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
    evidenceRefs: [],
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
    for (const env of [{}, { SETFARM_PROTOCOL: "legacy" }]) {
      const initialized = await initializeShadowAttemptRuntime({
        env,
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
      initializeShadowAttemptRuntime({ env: { SETFARM_PROTOCOL: "v3" } }),
      (error: any) => error?.code === "PROTOCOL_NOT_IMPLEMENTED",
    );
    await assert.rejects(
      initializeShadowAttemptRuntime({ env: { SETFARM_PROTOCOL: "observe" } }),
      (error: any) => error?.code === "PROTOCOL_INVALID_MODE",
    );
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
      evidenceRefs: [],
    });
    assert.equal(JSON.stringify(reservations).includes("prose"), false);
    assert.equal(events[0]?.code, "ATTEMPT_RESERVED");
  });

  it("turns repository failures and duplicate/stale outcomes into bounded observations", async () => {
    const events: any[] = [];
    const recorder = createShadowAttemptRecorder({
      repository: {
        reserve: async () => { throw new Error("database exploded with private detail"); },
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
      legacyClaimGeneration: 1,
      role: "developer",
      branch: "story/us-001",
      worktree: ".worktrees/us-001",
      sourceBefore: { sha: SHA_A, treeHash: TREE_A },
    });
    assert.equal(failed.status, "shadow_error");
    assert.equal(events.at(-1)?.event, "product_compiler.shadow_error");
    assert.ok((events.at(-1)?.message.length ?? 0) <= 500);

    const success = await recorder.observeSuccess({
      runId: "run-shadow",
      stepId: "implement",
      storyId: "US-001",
      sourceAfter: { sha: SHA_A, treeHash: TREE_A },
      evidenceRefs: [],
    });
    assert.deepEqual(success, { status: "observed", code: "ATTEMPT_STALE_FENCE" });
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
    const clean = captureShadowSourceRevision(root);
    assert.match(clean.sha, /^[a-f0-9]{40}$/);
    assert.match(clean.treeHash, /^[a-f0-9]{64}$/);

    execFileSync("git", ["update-index", "--assume-unchanged", "app.txt"], { cwd: root });
    await writeFile(path.join(root, "app.txt"), "two\n", "utf8");
    const assumedChanged = captureShadowSourceRevision(root);
    assert.notEqual(assumedChanged.treeHash, clean.treeHash);

    await writeFile(path.join(root, "new.txt"), "untracked\n", "utf8");
    const dirty = captureShadowSourceRevision(root);
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
      legacyClaimGeneration: 1,
      role: "developer",
      branch: "story/us-001",
      worktree: ".worktrees/us-001",
    }, {
      env: { SETFARM_PROTOCOL: "shadow" },
      createRuntime: async () => { throw new Error("compiler failed"); },
      onDiagnostic: (event) => diagnostics.push(event),
    });
    assert.equal(result.status, "shadow_error");
    assert.equal(diagnostics[0]?.event, "product_compiler.shadow_error");
  });
});
