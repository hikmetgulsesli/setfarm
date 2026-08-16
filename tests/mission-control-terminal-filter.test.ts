import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { projectDashboardRunForApi } from "../src/server/dashboard.js";
import type { RunInfo, StepInfo } from "../src/installer/status.js";

const root = path.resolve(import.meta.dirname, "..");

function runFixture(status: string, index: number): RunInfo & { steps: StepInfo[] } {
  return {
    id: `run-${index}`,
    run_number: index,
    workflow_id: "feature-dev",
    task: `task-${index}`,
    status,
    context: "{}",
    protocol: "legacy",
    protocol_version: 1,
    compiler_release_sha: null,
    packet_hash: null,
    activation_preflight_hash: null,
    created_at: `2026-08-16T00:00:0${index}Z`,
    updated_at: `2026-08-16T00:00:0${index}Z`,
    steps: [],
  };
}

const statusFixtures = [
  "running",
  "resuming",
  "cancelling",
  "failing",
  "pending",
  "completed",
  "failed",
  "cancelled",
  "error",
].map(runFixture);

describe("Mission Control run visibility", () => {
  it("returns exactly operational-active runs by default", () => {
    const projected = statusFixtures
      .map((run) => projectDashboardRunForApi(run))
      .filter((run) => run !== null);

    assert.deepEqual(
      projected.map(({ id, status, operationalActive }) => ({
        id,
        status,
        operationalActive,
      })),
      [
        { id: "run-0", status: "running", operationalActive: true },
        { id: "run-1", status: "resuming", operationalActive: true },
        { id: "run-2", status: "cancelling", operationalActive: true },
        { id: "run-3", status: "failing", operationalActive: true },
      ],
    );
  });

  it("retains every raw status with the correct boolean in explicit history", () => {
    const projected = statusFixtures.map((run) =>
      projectDashboardRunForApi(run, { includeTerminal: true }),
    );

    assert.deepEqual(
      projected.map((run) => ({
        id: run?.id,
        status: run?.status,
        operationalActive: run?.operationalActive,
      })),
      [
        { id: "run-0", status: "running", operationalActive: true },
        { id: "run-1", status: "resuming", operationalActive: true },
        { id: "run-2", status: "cancelling", operationalActive: true },
        { id: "run-3", status: "failing", operationalActive: true },
        { id: "run-4", status: "pending", operationalActive: false },
        { id: "run-5", status: "completed", operationalActive: false },
        { id: "run-6", status: "failed", operationalActive: false },
        { id: "run-7", status: "cancelled", operationalActive: false },
        { id: "run-8", status: "error", operationalActive: false },
      ],
    );
  });

  it("selects active workflows only from the server-produced boolean", () => {
    const html = fs.readFileSync(path.join(root, "src", "server", "index.html"), "utf-8");

    assert.match(html, /runs\.find\(r => r\.operationalActive === true\)/);
    assert.doesNotMatch(
      html,
      /r\.status === 'running'\s*\|\|\s*r\.status === 'pending'/,
    );
    assert.match(html, /let showTerminalRuns = false/);
    assert.match(html, /id="terminal-toggle"/);
    assert.match(html, /include_terminal=1/);
  });
});
