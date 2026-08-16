import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import {
  isSetfarmOperationalActiveRunStatusV1,
  SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1,
  SetfarmOperationalActiveRunStatusV1Schema,
} from "../src/contracts/operational-active-run-status-v1.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../src/product-compiler/canonical-json.js";

const execFileAsync = promisify(execFile);

const expectedStatuses = [
  "running",
  "resuming",
  "cancelling",
  "failing",
] as const;

test("publishes one frozen operational-active status tuple through the schema and predicate", () => {
  assert.equal(Object.isFrozen(SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1), true);
  assert.deepEqual(SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1, expectedStatuses);
  assert.deepEqual(SetfarmOperationalActiveRunStatusV1Schema.options, expectedStatuses);

  for (const status of expectedStatuses) {
    assert.equal(SetfarmOperationalActiveRunStatusV1Schema.parse(status), status);
    assert.equal(isSetfarmOperationalActiveRunStatusV1(status), true);
  }

  for (const status of [
    "pending",
    "queued",
    "waiting",
    "completed",
    "done",
    "failed",
    "cancelled",
    "canceled",
    "error",
    "unknown",
    null,
  ]) {
    assert.equal(SetfarmOperationalActiveRunStatusV1Schema.safeParse(status).success, false);
    assert.equal(isSetfarmOperationalActiveRunStatusV1(status), false);
  }
});

test("keeps every operational transition active and terminal transitions inactive", () => {
  const activeTransitions = [
    ["running", "resuming"],
    ["resuming", "cancelling"],
    ["cancelling", "failing"],
  ] as const;
  for (const [before, after] of activeTransitions) {
    assert.equal(isSetfarmOperationalActiveRunStatusV1(before), true);
    assert.equal(isSetfarmOperationalActiveRunStatusV1(after), true);
    assert.notEqual(before, after);
  }

  for (const before of expectedStatuses) {
    for (const terminal of ["completed", "failed", "cancelled"] as const) {
      assert.equal(isSetfarmOperationalActiveRunStatusV1(before), true);
      assert.equal(isSetfarmOperationalActiveRunStatusV1(terminal), false);
    }
  }
});

test("emits one canonical hash-bound JSON document through the silent npm command", async () => {
  const { stdout, stderr } = await execFileAsync(
    "npm",
    ["run", "--silent", "contract:operational-active-run-status", "--", "--json"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(stderr, "");

  const document = JSON.parse(stdout) as Record<string, unknown>;
  assert.deepEqual(document, {
    contractHash: document.contractHash,
    schema: "setfarm.operational-active-run-status.v1",
    statuses: expectedStatuses,
  });
  assert.equal(
    document.contractHash,
    hashCanonicalJson({
      schema: document.schema,
      statuses: document.statuses,
    }),
  );
  assert.equal(stdout, `${canonicalJsonStringify(document)}\n`);
});
