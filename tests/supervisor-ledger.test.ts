import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeLibraryPackSelection } from "../dist/installer/library-packs/ledger.js";
import { selectLibraryPacks } from "../dist/installer/library-packs/select.js";
import { resolveStackContract } from "../dist/installer/stack-contract/reconcile.js";
import { writeStackContract } from "../dist/installer/stack-contract/ledger.js";
import {
  appendSupervisorRepairHistory,
  collectOpenSupervisorFindings,
  collectPendingSupervisorInterventions,
  readSupervisorLedgerSummary,
  supervisorLedgerPaths,
  writeSupervisorFinalEvidence,
} from "../dist/installer/supervisor/ledger.js";
import { createEmptySupervisorState, writeSupervisorState, writeSupervisorVisualResult } from "../dist/installer/supervisor/state.js";
import type { SupervisorEvidence, SupervisorIntervention, SupervisorVisualResult } from "../dist/installer/supervisor/types.js";

function tmpDir(name: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `setfarm-${name}-`));
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file: string, value = ""): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

describe("supervisor ledger", () => {
  it("summarizes stack, library packs, findings, interventions, and visual status", () => {
    const repo = tmpDir("supervisor-ledger");
    try {
      writeText(path.join(repo, ".git/info/exclude"), "");
      writeJson(path.join(repo, "package.json"), {
        dependencies: { react: "^19.0.0" },
        devDependencies: { vite: "^7.0.0" },
      });
      const stack = resolveStackContract({
        repoPath: repo,
        taskText: "Build a dashboard with charts and forms.",
      });
      writeStackContract(repo, stack);
      writeLibraryPackSelection(repo, selectLibraryPacks({
        stackContract: stack,
        taskText: "Build a dashboard with charts and forms.",
        designText: "Use chart, input validation, table, and dialog patterns.",
      }));

      const state = createEmptySupervisorState("run-1");
      const finding: SupervisorEvidence = {
        itemId: "button-save",
        status: "dead-control",
        severity: "blocker",
        observed: ["Save button did not change state"],
        lastScan: "visual-qa",
        files: ["src/App.tsx"],
        message: "Save button is visible but inert.",
        checkedAt: "2026-05-16T00:00:00.000Z",
      };
      const intervention: SupervisorIntervention = {
        id: "int-1",
        itemId: "button-save",
        type: "retry-feedback",
        message: "Wire the save button to persistent state.",
        result: "pending",
        createdAt: "2026-05-16T00:00:00.000Z",
      };
      state.evidence[finding.itemId] = finding;
      state.interventions.push(intervention);
      state.stories["US-001"] = {
        status: "blocked",
        openBlockers: [finding.itemId],
        warnings: [],
        resolved: [],
      };
      writeSupervisorState(repo, state);

      const visual: SupervisorVisualResult = {
        schema: "setfarm.supervisor-visual-result.v1",
        runId: "run-1",
        storyId: "US-001",
        ok: false,
        routesChecked: ["/"],
        controlsChecked: 1,
        screenshots: [],
        issues: [{
          id: "dead-save",
          type: "dead_control",
          severity: "blocker",
          route: "/",
          viewport: "desktop",
          detail: "Save button did not change visible state.",
        }],
        artifactDir: path.join(repo, ".setfarm/supervisor/run-1/visual"),
        createdAt: "2026-05-16T00:00:00.000Z",
      };
      writeSupervisorVisualResult(repo, visual);

      const summary = readSupervisorLedgerSummary(repo, "run-1");

      assert.equal(summary.stackPackId, "vite-react-web-app");
      assert.equal(summary.libraryPackIds.includes("forms-validation"), true);
      assert.equal(summary.openFindingCount, 1);
      assert.equal(summary.pendingInterventionCount, 1);
      assert.equal(summary.visualStatus, "fail");
      assert.equal(summary.status, "blocked");
      assert.match(summary.artifacts.repairHistory, /\.setfarm\/ledger\/repair-history\.jsonl$/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("records repair history and final evidence under ignored ledger artifacts", () => {
    const repo = tmpDir("supervisor-ledger-write");
    try {
      writeText(path.join(repo, ".git/info/exclude"), "");

      const repairFile = appendSupervisorRepairHistory(repo, {
        runId: "run-2",
        storyId: "US-002",
        findingId: "link-details",
        actor: "supervisor",
        action: "Asked worker to wire details link.",
        result: "sent",
        createdAt: "2026-05-16T00:00:00.000Z",
      });
      const finalFile = writeSupervisorFinalEvidence(repo, {
        runId: "run-2",
        status: "passed",
        summary: "All stories passed supervisor checks.",
        libraryPackIds: [],
        openFindings: [],
      });

      assert.equal(repairFile, supervisorLedgerPaths(repo, "run-2").repairHistory);
      assert.equal(finalFile, supervisorLedgerPaths(repo, "run-2").finalEvidence);
      assert.match(fs.readFileSync(repairFile, "utf-8"), /Asked worker to wire details link/);
      assert.equal(JSON.parse(fs.readFileSync(finalFile, "utf-8")).schema, "setfarm.final-evidence.v1");
      assert.match(fs.readFileSync(path.join(repo, ".git/info/exclude"), "utf-8"), /^\.setfarm\/$/m);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("collects open findings and pending interventions deterministically", () => {
    const evidence: Record<string, SupervisorEvidence> = {
      z: {
        itemId: "z",
        status: "dead-control",
        severity: "blocker",
        observed: [],
        lastScan: "scanner",
        files: [],
        message: "blocked",
        checkedAt: "2026-05-16T00:00:00.000Z",
      },
      a: {
        itemId: "a",
        status: "passed",
        severity: "blocker",
        observed: [],
        lastScan: "scanner",
        files: [],
        message: "passed",
        checkedAt: "2026-05-16T00:00:00.000Z",
      },
    };
    const interventions: SupervisorIntervention[] = [
      { id: "b", itemId: "z", type: "retry-feedback", message: "b", result: "resolved", createdAt: "2026-05-16T00:00:00.000Z" },
      { id: "a", itemId: "z", type: "retry-feedback", message: "a", result: "sent", createdAt: "2026-05-16T00:00:00.000Z" },
    ];

    assert.deepEqual(collectOpenSupervisorFindings(evidence), ["z"]);
    assert.deepEqual(collectPendingSupervisorInterventions(interventions), ["a"]);
  });
});
