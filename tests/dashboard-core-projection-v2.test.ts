import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import type { RunInfo, StepInfo } from "../src/installer/status.js";

const projectionUrl = new URL("../src/server/dashboard-core-projection-v2.js", import.meta.url);

async function projections(): Promise<typeof import("../src/server/dashboard-core-projection-v2.js")> {
  return import(projectionUrl.href);
}

function run(status: string): RunInfo & { steps: StepInfo[]; extra: string } {
  return {
    id: "r", run_number: 1, workflow_id: "w", task: "t", status, context: "{}",
    protocol: "legacy", protocol_version: 1, compiler_release_sha: null,
    packet_hash: null, activation_preflight_hash: null,
    created_at: "2026-10-07T00:00:00Z", updated_at: "2026-10-07T00:00:00Z",
    steps: [], extra: "preserved",
  };
}

for (const [status, derived, active] of [
  ["running", "active", true], ["resuming", "active", true],
  ["cancelling", "active", true], ["failing", "active", true],
  ["pending", "queued", false], [" RUNNING ", "queued", false],
  ["completed", "completed", false], [" DONE ", "completed", false],
  ["failed", "terminal", false], ["cancelled", "terminal", false],
  ["canceled", "terminal", false], [" ERROR ", "terminal", false],
  ["unknown", "queued", false], ["", "queued", false],
] as const) {
  test(`run projection preserves legacy status ${JSON.stringify(status)}`, async () => {
    const { projectDashboardRunForApi } = await projections();
    const input = run(status);
    const ordinary = projectDashboardRunForApi(input);
    assert.equal(ordinary === null, !active);
    const history = projectDashboardRunForApi(input, { includeTerminal: true });
    assert.ok(history);
    assert.deepEqual(history, { ...input, operationalActive: active, terminal: derived === "terminal", derived_status: derived });
    assert.equal(history.steps, input.steps);
    assert.equal(input.status, status);
    assert.equal(Object.hasOwn(input, "operationalActive"), false);
  });
}

const row = {
  id: "o", run_id: "r", step_id: "s", story_id: "story", agent_id: null,
  phase: "check", check_id: "check", label: "label", status: "pass",
  summary: null, detail: "detail", event_type: "checked", started_at: null,
  completed_at: "end", created_at: "created", updated_at: "updated",
  evidence: "{\"ok\":true}", file_paths: "[\"a\"]", github: "{}", metadata: "{}",
};

test("observations retain exact camelCase fields and omit extra columns", async () => {
  const { projectDashboardObservationForApiV2 } = await projections();
  const input = { ...row, private_extra: "not exported" };
  assert.deepEqual(projectDashboardObservationForApiV2(input), {
    id: "o", runId: "r", stepId: "s", storyId: "story", agentId: null,
    phase: "check", checkId: "check", label: "label", status: "pass", summary: null,
    detail: "detail", eventType: "checked", startedAt: null, completedAt: "end",
    createdAt: "created", updatedAt: "updated", evidence: { ok: true },
    filePaths: ["a"], github: {}, metadata: {},
  });
});

for (const raw of [undefined, null, "", "invalid", "{"]) {
  test(`observations preserve JSON fallback for ${JSON.stringify(raw)}`, async () => {
    const { projectDashboardObservationForApiV2: project } = await projections();
    const input = { ...row, evidence: raw, file_paths: raw, github: raw, metadata: raw };
    const first = project(input), second = project(input);
    assert.deepEqual([first.evidence, first.filePaths, first.github, first.metadata], [{}, [], {}, {}]);
    assert.notEqual(first.evidence, second.evidence);
    assert.notEqual(first.filePaths, second.filePaths);
    assert.equal(input.evidence, raw);
  });
}

for (const [raw, expected] of [["null", null], ["false", false], ["3", 3], ['"text"', "text"], ["[]", []]] as const) {
  test(`observations preserve valid JSON scalar/array ${raw}`, async () => {
    const { projectDashboardObservationForApiV2: project } = await projections();
    assert.deepEqual(project({ ...row, evidence: raw }).evidence, expected);
  });
}

test("observations preserve existing non-string object identity", async () => {
  const { projectDashboardObservationForApiV2: project } = await projections();
  const object = { existing: true }, paths = ["a"];
  const projected = project({ ...row, evidence: object, file_paths: paths });
  assert.equal(projected.evidence, object);
  assert.equal(projected.filePaths, paths);
});

test("observation timestamps retain Date identity and ordinary JSON serialization", async () => {
  const { projectDashboardObservationForApiV2: project } = await projections();
  const timestamp = new Date("2026-10-07T00:00:00.000Z");
  const projected = project({ ...row, created_at: timestamp, updated_at: timestamp });
  assert.equal(projected.createdAt, timestamp);
  assert.equal(projected.updatedAt, timestamp);
  const json = JSON.parse(JSON.stringify(projected));
  assert.equal(json.createdAt, "2026-10-07T00:00:00.000Z");
  assert.equal(json.updatedAt, json.createdAt);
});

test("run projection replaces stale derived fields without mutating input", async () => {
  const { projectDashboardRunForApi: project } = await projections();
  const input = { ...run("failed"), operationalActive: true, terminal: false, derived_status: "active" };
  const projected = project(input, { includeTerminal: true });
  assert.ok(projected);
  assert.equal(projected.operationalActive, false);
  assert.equal(projected.terminal, true);
  assert.equal(projected.derived_status, "terminal");
  assert.equal(input.operationalActive, true);
  assert.equal(input.terminal, false);
  assert.equal(input.derived_status, "active");
});

test("shared projection has no runtime service imports and dashboard uses that same implementation", async () => {
  await projections();
  const source = fs.readFileSync(new URL("../src/server/dashboard-core-projection-v2.ts", import.meta.url), "utf8");
  const imports = source.match(/^import .*$/gm) ?? [];
  assert.deepEqual(imports.filter(line => !line.startsWith("import type ")), [
    'import { isSetfarmOperationalActiveRunStatusV1 } from "../contracts/operational-active-run-status-v1.js";',
  ]);
  const dashboard = fs.readFileSync(new URL("../src/server/dashboard.ts", import.meta.url), "utf8");
  assert.match(dashboard, /export \{ projectDashboardRunForApi \} from "\.\/dashboard-core-projection-v2\.js"/);
  assert.match(dashboard, /return rows\.map\(projectDashboardObservationForApiV2\)/);
  assert.doesNotMatch(dashboard, /function dashboardDerivedStatus|function safeJson|function projectDashboardRunForApi/);
});
