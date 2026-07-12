import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  InMemoryAttemptDecisionModel,
  runContractReplay,
} from "../../src/evals/contract-replay.js";
import { stableContractReplayJson } from "../../src/evals/contract-replay-report.js";

const roots: string[] = [];
const FIXTURE_ROOT = path.resolve("evals/fixtures");
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const SHA_A = "1".repeat(40);
const TREE_A = "2".repeat(40);

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("offline Product Compiler contract replay", () => {
  it("replays all historical product classes deterministically", async () => {
    const first = await runContractReplay({ fixtureRoot: FIXTURE_ROOT });
    const second = await runContractReplay({ fixtureRoot: FIXTURE_ROOT });
    assert.deepEqual(second, first);
    assert.equal(stableContractReplayJson(second), stableContractReplayJson(first));
    assert.deepEqual(first.fixtures.map((item) => item.caseId), [
      "1887-action-state",
      "1893-persistence",
      "1894-branch-continuity",
      "1925-task-chip",
      "847-required-evidence",
      "vibe-control-id",
    ]);
    assert.ok(new Set(first.fixtures.map((item) => item.productClass)).size >= 2);
    assert.equal(first.summary.passed, 6);
    assert.equal(first.summary.failed, 0);
  });

  it("recovers exact #1925 identity without accepting guessed prose tokens", async () => {
    const report = await runContractReplay({ fixtureRoot: FIXTURE_ROOT });
    const result = report.fixtures.find((item) => item.caseId === "1925-task-chip");
    assert.deepEqual(result?.compilation.exactBindings, [{
      actionRef: "ACT_SAVE_RECORD",
      generatedLocalId: "save-changes-7",
      provenance: "same_element",
    }]);
    assert.deepEqual(result?.compilation.diagnosticCodes, [
      "CONTRACT_ACTION_RENAMED",
      "LINK_UNRESOLVED_SURFACE",
    ]);
    assert.equal(result?.attempt?.disposition, "duplicate");
  });

  it("keeps failed required evidence blocking and revision changes distinct", async () => {
    const report = await runContractReplay({ fixtureRoot: FIXTURE_ROOT });
    const evidence = report.fixtures.find((item) => item.caseId === "847-required-evidence");
    assert.deepEqual(evidence?.compilation.diagnosticCodes, ["EVIDENCE_REQUIRED_CHILD_FAILED"]);
    const continuity = report.fixtures.find((item) => item.caseId === "1894-branch-continuity");
    assert.deepEqual(continuity?.attempt, {
      disposition: "source_revision_changed",
      dedupeEligible: false,
      diagnosticCodes: ["ATTEMPT_SOURCE_REVISION_CHANGED"],
    });
  });

  it("dedupes exact tuples within one run but never across runs", () => {
    const model = new InMemoryAttemptDecisionModel();
    const base = {
      runId: "eval-run-a",
      stepId: "implement",
      storyId: "US-002",
      attemptClass: "product_implementation" as const,
      packetHash: HASH_A,
      compilationReportHash: HASH_B,
      sliceHash: HASH_C,
      sourceBefore: { sha: SHA_A, treeHash: TREE_A },
      findingSetHash: HASH_D,
      role: "developer",
      evidenceRefs: [],
    };
    assert.equal(model.reserve(base).status, "reserved");
    assert.equal(model.reserve(base).status, "duplicate");
    assert.equal(model.reserve({ ...base, runId: "eval-run-b" }).status, "reserved");
  });

  it("fails on fixture hash drift without rewriting expected snapshots", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-contract-replay-drift-"));
    roots.push(root);
    await cp(FIXTURE_ROOT, root, { recursive: true });
    const expectedPath = path.join(root, "1887-action-state", "expected", "compilation-result.json");
    const expectedBefore = await readFile(expectedPath, "utf8");
    await writeFile(
      path.join(root, "1887-action-state", "sources", "unbound-controls.tsx"),
      "drift\n",
      "utf8",
    );
    await assert.rejects(
      runContractReplay({ fixtureRoot: root }),
      /FIXTURE_SOURCE_HASH_DRIFT/,
    );
    assert.equal(await readFile(expectedPath, "utf8"), expectedBefore);
  });

  it("keeps product-specific fixture identifiers out of generic replay code", async () => {
    const source = await readFile(path.resolve("src/evals/contract-replay.ts"), "utf8");
    assert.doesNotMatch(source, /1887|1893|1894|1925|847|vibe-control-id/i);
    assert.doesNotMatch(source, /db-pg|postgres|github|openclaw|https?:\/\//i);
  });
});
