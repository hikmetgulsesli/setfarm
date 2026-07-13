import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  RunProtocolError,
  createRunProtocolRepository,
  extractProtocolArgument,
  resolveNewRunProtocol,
} from "../../src/execution/run-protocol.js";
import { persistWorkflowRun } from "../../src/execution/run-persistence.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const RELEASE_SHA = "a".repeat(40);
const PREFLIGHT_HASH = "b".repeat(64);

describe("run-pinned product compiler protocol", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  it("defaults new runs to legacy and lets an explicit shadow mode override the environment", () => {
    assert.deepEqual(
      resolveNewRunProtocol({ compilerReleaseSha: RELEASE_SHA, env: {} }),
      {
        mode: "legacy",
        version: 1,
        compilerReleaseSha: RELEASE_SHA,
        activationPreflightHash: null,
      },
    );
    assert.equal(
      resolveNewRunProtocol({
        requestedMode: "shadow",
        compilerReleaseSha: RELEASE_SHA,
        env: { SETFARM_PROTOCOL: "legacy" },
      }).mode,
      "shadow",
    );
  });

  it("rejects invalid configuration before run-number allocation is reachable", () => {
    for (const requestedMode of ["", "SHADOW", " shadow", "observe"]) {
      assert.throws(
        () => resolveNewRunProtocol({ requestedMode, compilerReleaseSha: RELEASE_SHA, env: {} }),
        (error: unknown) =>
          error instanceof RunProtocolError
          && error.code === "RUN_PROTOCOL_INVALID_MODE",
      );
    }

    const runSource = readFileSync(
      path.resolve(import.meta.dirname, "../../src/installer/run.ts"),
      "utf8",
    );
    const resolveIndex = runSource.indexOf("resolveNewRunProtocol(");
    const sequenceIndex = runSource.indexOf("await pgNextRunNumber()");
    assert.ok(resolveIndex >= 0 && sequenceIndex > resolveIndex);
  });

  it("requires both explicit activation and a passing preflight for v3", () => {
    assert.throws(
      () => resolveNewRunProtocol({
        requestedMode: "v3",
        compilerReleaseSha: RELEASE_SHA,
        env: {},
        activationPreflight: { status: "pass", hash: PREFLIGHT_HASH },
      }),
      (error: unknown) =>
        error instanceof RunProtocolError
        && error.code === "RUN_PROTOCOL_V3_DISABLED",
    );
    assert.throws(
      () => resolveNewRunProtocol({
        requestedMode: "v3",
        compilerReleaseSha: RELEASE_SHA,
        env: { SETFARM_V3_ACTIVATION: "enabled" },
      }),
      (error: unknown) =>
        error instanceof RunProtocolError
        && error.code === "RUN_PROTOCOL_PREFLIGHT_REQUIRED",
    );
    assert.deepEqual(
      resolveNewRunProtocol({
        requestedMode: "v3",
        compilerReleaseSha: RELEASE_SHA,
        env: { SETFARM_V3_ACTIVATION: "enabled" },
        activationPreflight: { status: "pass", hash: PREFLIGHT_HASH },
      }),
      {
        mode: "v3",
        version: 1,
        compilerReleaseSha: RELEASE_SHA,
        activationPreflightHash: PREFLIGHT_HASH,
      },
    );
  });

  it("extracts one protocol flag without leaking it into the task", () => {
    assert.deepEqual(
      extractProtocolArgument(["build", "a", "game", "--protocol", "shadow"]),
      { requestedMode: "shadow", remainingArgs: ["build", "a", "game"] },
    );
    assert.deepEqual(
      extractProtocolArgument(["build", "a", "game"]),
      { requestedMode: undefined, remainingArgs: ["build", "a", "game"] },
    );
    assert.throws(
      () => extractProtocolArgument(["task", "--protocol"]),
      (error: unknown) =>
        error instanceof RunProtocolError
        && error.code === "RUN_PROTOCOL_FLAG_INVALID",
    );
    assert.throws(
      () => extractProtocolArgument(["task", "--protocol", "legacy", "--protocol", "shadow"]),
      (error: unknown) =>
        error instanceof RunProtocolError
        && error.code === "RUN_PROTOCOL_FLAG_INVALID",
    );
  });

  it("persists protocol identity atomically with the run and steps", async () => {
    const protocol = resolveNewRunProtocol({
      requestedMode: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      env: {},
    });
    await database.sql.begin((sql) => persistWorkflowRun(sql, {
      run: {
        id: "run-protocol-atomic",
        runNumber: 91,
        workflowId: "feature-dev",
        task: "atomic protocol",
        context: "{}",
        notifyUrl: null,
        createdAt: "2026-07-13T00:00:00.000Z",
        protocol,
      },
      steps: [{
        id: "step-protocol-atomic",
        stepId: "plan",
        agentId: "feature-dev_planner",
        stepIndex: 0,
        inputTemplate: "task",
        expects: "plan",
        status: "pending",
        maxRetries: 2,
        type: "single",
        loopConfig: null,
      }],
    }));

    const row = await database.sql<{
      protocol: string;
      protocol_version: number;
      compiler_release_sha: string | null;
      activation_preflight_hash: string | null;
      steps: number;
    }[]>`
      SELECT r.protocol, r.protocol_version, r.compiler_release_sha,
             r.activation_preflight_hash,
             (SELECT COUNT(*)::integer FROM steps s WHERE s.run_id = r.id) AS steps
      FROM runs r
      WHERE r.id = 'run-protocol-atomic'
    `;
    assert.deepEqual({ ...row[0] }, {
      protocol: "shadow",
      protocol_version: 1,
      compiler_release_sha: RELEASE_SHA,
      activation_preflight_hash: null,
      steps: 1,
    });

    await assert.rejects(
      database.sql.begin((sql) => persistWorkflowRun(sql, {
        run: {
          id: "run-protocol-rollback",
          runNumber: 92,
          workflowId: "feature-dev",
          task: "must roll back",
          context: "{}",
          notifyUrl: null,
          createdAt: "2026-07-13T00:00:00.000Z",
          protocol,
        },
        steps: [
          {
            id: "duplicate-step",
            stepId: "plan",
            agentId: "planner",
            stepIndex: 0,
            inputTemplate: "task",
            expects: "plan",
            status: "pending",
            maxRetries: 2,
            type: "single",
            loopConfig: null,
          },
          {
            id: "duplicate-step",
            stepId: "design",
            agentId: "designer",
            stepIndex: 1,
            inputTemplate: "plan",
            expects: "design",
            status: "waiting",
            maxRetries: 2,
            type: "single",
            loopConfig: null,
          },
        ],
      })),
    );
    const rolledBack = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count FROM runs WHERE id = 'run-protocol-rollback'
    `;
    assert.equal(rolledBack[0]?.count, 0);
  });

  it("reads the stored mode after environment changes and rejects protocol mutation", async () => {
    const repository = createRunProtocolRepository(database.sql);
    process.env.SETFARM_PROTOCOL = "legacy";
    try {
      const stored = await repository.read("run-protocol-atomic");
      assert.equal(stored.mode, "shadow");
      assert.equal(stored.compilerReleaseSha, RELEASE_SHA);
    } finally {
      delete process.env.SETFARM_PROTOCOL;
    }

    await assert.rejects(
      database.sql`UPDATE runs SET protocol = 'v3' WHERE id = 'run-protocol-atomic'`,
      /RUN_PROTOCOL_IMMUTABLE/,
    );
    assert.equal((await repository.read("run-protocol-atomic")).mode, "shadow");
  });
});
