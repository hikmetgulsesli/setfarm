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
import {
  RunActivationConflictError,
  persistWorkflowRun,
} from "../../src/execution/run-persistence.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { exactBoundProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const RELEASE_SHA = "a".repeat(40);
const PREFLIGHT_HASH = "b".repeat(64);
const PASS_PREFLIGHT = {
  status: "pass" as const,
  hash: PREFLIGHT_HASH,
  stored: true,
};
const RELEASE_ADMISSION_HASH = "c".repeat(64);
const RELEASE_GO_ADMISSION = {
  admissionHash: RELEASE_ADMISSION_HASH,
  kind: "release_go" as const,
  releaseSha: RELEASE_SHA,
  canary: null,
};

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
        releaseAdmissionHash: null,
        releaseAdmissionKind: null,
        canaryAdmission: null,
      },
    );
    assert.equal(
      resolveNewRunProtocol({
        requestedMode: "shadow",
        compilerReleaseSha: RELEASE_SHA,
        env: { SETFARM_PROTOCOL: "legacy" },
        activationPreflight: PASS_PREFLIGHT,
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

  it("treats activation as a kill switch and also requires exact release authority for v3", () => {
    assert.throws(
      () => resolveNewRunProtocol({
        requestedMode: "v3",
        compilerReleaseSha: RELEASE_SHA,
        env: {},
        activationPreflight: PASS_PREFLIGHT,
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
      (() => {
        assert.throws(
          () => resolveNewRunProtocol({
            requestedMode: "v3",
            compilerReleaseSha: RELEASE_SHA,
            env: { SETFARM_V3_ACTIVATION: "enabled" },
            activationPreflight: PASS_PREFLIGHT,
          }),
          (error: unknown) => error instanceof RunProtocolError
            && error.code === "RUN_PROTOCOL_RELEASE_ADMISSION_REQUIRED",
        );
        return resolveNewRunProtocol({
          requestedMode: "v3",
          compilerReleaseSha: RELEASE_SHA,
          env: { SETFARM_V3_ACTIVATION: "enabled" },
          activationPreflight: PASS_PREFLIGHT,
          releaseAdmission: RELEASE_GO_ADMISSION,
        });
      })(),
      {
        mode: "v3",
        version: 1,
        compilerReleaseSha: RELEASE_SHA,
        activationPreflightHash: PREFLIGHT_HASH,
        releaseAdmissionHash: RELEASE_ADMISSION_HASH,
        releaseAdmissionKind: "release_go",
        canaryAdmission: null,
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

  it("serializes concurrent compiler-run admission and accepts one owner", async () => {
    const protocol = resolveNewRunProtocol({
      requestedMode: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      env: {},
      activationPreflight: PASS_PREFLIGHT,
    });
    const create = (id: string, runNumber: number) => database.sql.begin((sql) =>
      persistWorkflowRun(sql, {
        run: {
          id,
          runNumber,
          workflowId: "feature-dev",
          task: `concurrent ${id}`,
          context: "{}",
          notifyUrl: null,
          createdAt: "2026-07-13T00:00:00.000Z",
          protocol,
        },
        steps: [],
      }));
    const results = await Promise.allSettled([
      create("run-protocol-concurrent-a", 89),
      create("run-protocol-concurrent-b", 90),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.equal(rejected.reason?.code, "RUN_ACTIVATION_CONFLICT");
    await database.sql`
      UPDATE runs SET status = 'completed'
      WHERE id IN ('run-protocol-concurrent-a', 'run-protocol-concurrent-b')
    `;
  });

  it("treats a resuming run as active during compiler admission", async () => {
    await database.sql`
      INSERT INTO runs (id, run_number, workflow_id, task, status)
      VALUES ('run-protocol-resuming-owner', 95, 'feature-dev', 'resuming owner', 'resuming')
    `;
    const protocol = resolveNewRunProtocol({
      requestedMode: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      env: {},
      activationPreflight: PASS_PREFLIGHT,
    });
    try {
      await assert.rejects(
        database.sql.begin((sql) => persistWorkflowRun(sql, {
          run: {
            id: "run-protocol-after-resuming",
            runNumber: 96,
            workflowId: "feature-dev",
            task: "must wait for resume",
            context: "{}",
            notifyUrl: null,
            createdAt: "2026-07-13T00:00:00.000Z",
            protocol,
          },
          steps: [],
        })),
        (error: unknown) =>
          error instanceof RunActivationConflictError
          && error.code === "RUN_ACTIVATION_CONFLICT",
      );
    } finally {
      await database.sql`DELETE FROM runs WHERE id = 'run-protocol-resuming-owner'`;
    }
  });

  it("rechecks active attempt ownership inside the admission lock", async () => {
    await database.insertRun("run-protocol-leaked-attempt-owner");
    const attempts = createAttemptRepository(database.sql);
    const reserved = await attempts.reserve(await exactBoundProductReservation(database.sql, {
      runId: "run-protocol-leaked-attempt-owner",
      storyId: "US-ADMISSION-FENCE",
    }));
    assert.equal(reserved.status, "reserved");
    await database.sql`
      UPDATE runs SET status = 'cancelled'
      WHERE id = 'run-protocol-leaked-attempt-owner'
    `;
    const protocol = resolveNewRunProtocol({
      requestedMode: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      env: {},
      activationPreflight: PASS_PREFLIGHT,
    });
    try {
      await assert.rejects(
        database.sql.begin((sql) => persistWorkflowRun(sql, {
          run: {
            id: "run-protocol-after-leaked-attempt",
            runNumber: 97,
            workflowId: "feature-dev",
            task: "must not pass stale preflight",
            context: "{}",
            notifyUrl: null,
            createdAt: "2026-07-13T00:00:00.000Z",
            protocol,
          },
          steps: [],
        })),
        (error: unknown) =>
          error instanceof RunActivationConflictError
          && error.code === "RUN_ACTIVATION_CONFLICT",
      );
    } finally {
      await database.sql`
        UPDATE execution_attempts SET disposition = 'inconclusive'
        WHERE attempt_id = ${reserved.attempt.attemptId}
      `;
      await database.sql`
        UPDATE claim_log SET outcome = 'test_cleanup'
        WHERE id = ${reserved.attempt.claimId!}
      `;
      await database.sql`DELETE FROM runs WHERE id = 'run-protocol-leaked-attempt-owner'`;
    }
  });

  it("persists protocol identity atomically with the run and steps", async () => {
    const protocol = resolveNewRunProtocol({
      requestedMode: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      env: {},
      activationPreflight: PASS_PREFLIGHT,
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
      activation_preflight_hash: PREFLIGHT_HASH,
      steps: 1,
    });

    await assert.rejects(
      database.sql.begin((sql) => persistWorkflowRun(sql, {
        run: {
          id: "run-protocol-conflict",
          runNumber: 92,
          workflowId: "feature-dev",
          task: "must conflict",
          context: "{}",
          notifyUrl: null,
          createdAt: "2026-07-13T00:00:00.000Z",
          protocol,
        },
        steps: [],
      })),
      (error: unknown) =>
        error instanceof RunActivationConflictError
        && error.code === "RUN_ACTIVATION_CONFLICT",
    );
    await database.sql`UPDATE runs SET status = 'completed' WHERE id = 'run-protocol-atomic'`;

    await assert.rejects(
      database.sql.begin((sql) => persistWorkflowRun(sql, {
        run: {
          id: "run-protocol-rollback",
          runNumber: 93,
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
    await assert.rejects(
      database.sql`
        INSERT INTO runs
          (id, run_number, workflow_id, task, protocol, protocol_version, compiler_release_sha)
        VALUES
          ('run-shadow-without-preflight', 94, 'feature-dev', 'invalid shadow',
           'shadow', 1, ${RELEASE_SHA})
      `,
      /runs_compiler_preflight_check/,
    );
  });
});
