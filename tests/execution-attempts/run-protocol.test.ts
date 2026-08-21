import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";

import {
  RunProtocolError,
  createRunProtocolRepository,
  extractProtocolArgument,
  resolveNewRunProtocol,
} from "../../src/execution/run-protocol.js";
import {
  type PersistWorkflowRunInputV1,
} from "../../src/execution/run-persistence.js";
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

  const seedProtocolRun = async (input: PersistWorkflowRunInputV1): Promise<void> => {
    await database.sql.begin(async (sql) => {
      await sql.unsafe(
        `INSERT INTO runs
           (id,run_number,workflow_id,task,status,context,notify_url,protocol,
            protocol_version,compiler_release_sha,activation_preflight_hash,
            release_admission_hash,created_at,updated_at)
         VALUES ($1,$2,$3,$4,'running',$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [
          input.run.id,
          input.run.runNumber,
          input.run.workflowId,
          input.run.task,
          input.run.context,
          input.run.notifyUrl,
          input.run.protocol.mode,
          input.run.protocol.version,
          input.run.protocol.compilerReleaseSha,
          input.run.protocol.activationPreflightHash,
          input.run.protocol.releaseAdmissionHash,
          input.run.createdAt,
        ],
      );
      for (const step of input.steps) {
        await sql.unsafe(
          `INSERT INTO steps
             (id,run_id,step_id,agent_id,step_index,input_template,expects,status,
              max_retries,type,loop_config,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
          [step.id,input.run.id,step.stepId,step.agentId,step.stepIndex,
            step.inputTemplate,step.expects,step.status,step.maxRetries,step.type,
            step.loopConfig,input.run.createdAt],
        );
      }
    });
  };

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  it("run persistence exposes exact inner and post-commit public ABI", async () => {
    const persistence = await import("../../src/execution/run-persistence.js");
    assert.equal(typeof persistence.persistWorkflowRunInTransaction, "function");
    assert.equal(persistence.persistWorkflowRunInTransaction.length, 2);
    assert.equal(persistence.persistWorkflowRun.length, 1);

    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../src/execution/run-persistence.ts"),
      "utf8",
    );
    const fence = source.indexOf("FOR UPDATE", source.indexOf("version = 31"));
    const begin = source.indexOf("beginOrAdoptInternalProductionOwnerReservationV1", fence);
    const census = source.indexOf("AS active_runs", begin);
    const insert = source.indexOf("INSERT INTO runs", census);
    const bind = source.indexOf("bindInternalProductionOwnerReservationV1", insert);
    assert.ok(fence >= 0 && begin > fence && census > begin && insert > census && bind > insert);
    assert.doesNotMatch(source, /runAdmissionLockKey|pg_advisory_xact_lock/);
    assert.match(source, /await pgBegin\(async \(sql\) => \{/);
    assert.match(source, /tentative = await persistWorkflowRunInTransaction\(sql, input\)/);
    assert.match(source, /return undefined;/);
    assert.ok(source.indexOf("return committed;") > source.indexOf("await pgBegin("));

    const dbSource = readFileSync(
      path.resolve(import.meta.dirname, "../../src/db-pg.ts"),
      "utf8",
    );
    assert.equal(
      dbSource.match(/new URL\("\.\/internal-production\/baseline-spawner-startup-admission-v1\.js", import\.meta\.url\)\.href/g)?.length,
      1,
    );
    assert.match(dbSource, /observeInternalProductionPreSchemaSpawnerRebindStatusV1\(\)/);
    assert.match(dbSource, /resolveInternalProductionTask0SpawnerAdmissionReadyV1\(status\.admissionReady\)/);
    assert.match(dbSource, /Object\.keys\(module\)/);
    assert.match(dbSource, /observeInternalProductionPreSchemaSpawnerRebindStatusV1\.length !== 0/);
    assert.match(dbSource, /resolveInternalProductionTask0SpawnerAdmissionReadyV1\.length !== 1/);
    assert.match(dbSource, /6cf01b73fab3004670c98f71ef0c2ac9ee4852f697cfbd976d359807f65abf17/);
    assert.match(dbSource, /currentResolution\.nodes/);
    assert.doesNotMatch(dbSource, /current\.receipt\.phase\s*!==\s*"A"/);

    const installerSource = readFileSync(
      path.resolve(import.meta.dirname, "../../src/installer/run.ts"),
      "utf8",
    );
    assert.match(installerSource, /import \{\s*persistWorkflowRun,\s*type PersistedWorkflowStep,?\s*\} from "\.\.\/execution\/run-persistence\.js";/s);
    assert.doesNotMatch(installerSource, /persistWorkflowRunInTransaction/);
  });

  it("public persistence exposes no tentative result before commit acknowledgement", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-run-persistence-commit-boundary-"));
    try {
      const source = readFileSync(
        path.resolve(import.meta.dirname, "../../src/execution/run-persistence.ts"),
        "utf8",
      );
      const wrapper = source.slice(source.indexOf("export async function persistWorkflowRun("));
      assert.match(wrapper, /^export async function persistWorkflowRun\(/);
      const modulePath = path.join(root, "wrapper.ts");
      await writeFile(modulePath, `
type PersistWorkflowRunInputV1 = unknown;
type PersistWorkflowRunResultV1 = Readonly<{ run: Readonly<{ id: string }> }>;
let acknowledgeCommit;
let callbackReturned;
let commitError;
let callbackValue;
let result = Object.freeze({ run: Object.freeze({ id: "committed-run" }) });
let acknowledgement = new Promise((resolve) => { acknowledgeCommit = resolve; });
let callbackObserved = new Promise((resolve) => { callbackReturned = resolve; });
async function persistWorkflowRunInTransaction() { return result; }
async function pgBegin(operation) {
  callbackValue = await operation(Object.freeze({}));
  callbackReturned(callbackValue);
  await acknowledgement;
  if (commitError) throw commitError;
}
export function controls() {
  return {
    acknowledge(value) { commitError = value; acknowledgeCommit(); },
    callbackObserved,
    callbackValue: () => callbackValue,
  };
}
${wrapper}
`, "utf8");
      const module = await import(`${pathToFileURL(modulePath).href}?commit=${Date.now()}`);
      const controls = module.controls();
      let settled = false;
      const pending = module.persistWorkflowRun(Object.freeze({})).finally(() => { settled = true; });
      assert.equal(await controls.callbackObserved, undefined);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(controls.callbackValue(), undefined);
      assert.equal(settled, false);
      controls.acknowledge(undefined);
      assert.deepEqual(await pending, { run: { id: "committed-run" } });

      const rejectedModule = await import(`${pathToFileURL(modulePath).href}?reject=${Date.now()}`);
      const rejectedControls = rejectedModule.controls();
      let rejectedSettled = false;
      const rejected = rejectedModule.persistWorkflowRun(Object.freeze({}))
        .finally(() => { rejectedSettled = true; });
      assert.equal(await rejectedControls.callbackObserved, undefined);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(rejectedSettled, false);
      rejectedControls.acknowledge(new Error("TEST_COMMIT_REJECTED"));
      await assert.rejects(rejected, /^Error: TEST_COMMIT_REJECTED$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

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

  it("keeps compiler-run admission under the database-owned insertion fence", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "../../src/execution/run-persistence.ts"), "utf8");
    assert.match(source, /lockInternalProductionWorkflowRunInsertionFenceV1\(sql\)/);
    assert.match(source, /status IN \('running', 'resuming'\)/);
    assert.match(source, /disposition IN \('claimed', 'running'\)/);
    assert.match(source, /new RunActivationConflictError\(\)/);
  });

  it("persists protocol identity atomically with the run and steps", async () => {
    const protocol = resolveNewRunProtocol({
      requestedMode: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      env: {},
      activationPreflight: PASS_PREFLIGHT,
    });
    await seedProtocolRun({
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
    });

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

    await database.sql`UPDATE runs SET status = 'completed' WHERE id = 'run-protocol-atomic'`;

    await assert.rejects(
      seedProtocolRun({
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
      }),
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
