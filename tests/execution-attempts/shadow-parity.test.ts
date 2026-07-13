import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  buildShadowParityReport,
  legacyClaimEvidenceRef,
  readShadowParityReport,
} from "../../src/execution/shadow-parity.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const RELEASE_SHA = "a".repeat(40);
const HASH = "b".repeat(64);
const TREE = "c".repeat(64);

function attempt(
  attemptId: string,
  claimId: number | null,
  disposition = "produced_delta",
  leaseExpiresAt = "2027-01-01T00:00:00.000Z",
) {
  return {
    attempt_id: attemptId,
    generation: 1,
    attempt_class: "product_implementation",
    disposition,
    lease_expires_at: leaseExpiresAt,
    evidence_refs: JSON.stringify(claimId === null ? [] : [legacyClaimEvidenceRef(claimId)]),
  };
}

describe("shadow claim/attempt parity", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  it("classifies exact missing, duplicate, stale, terminal-active, invalid, and orphan evidence", () => {
    const claims = [
      { id: 1, step_id: "implement", story_id: "US-001", agent_id: "developer", outcome: "completed" },
      { id: 2, step_id: "implement", story_id: "US-002", agent_id: "developer", outcome: null },
      { id: 3, step_id: "implement", story_id: "US-003", agent_id: "developer", outcome: "completed" },
      { id: 4, step_id: "implement", story_id: "US-004", agent_id: "developer", outcome: "failed" },
      { id: 5, step_id: "verify", story_id: "US-005", agent_id: "reviewer", outcome: null },
      { id: 6, step_id: "plan", story_id: null, agent_id: "planner", outcome: "completed" },
    ];
    const attempts = [
      attempt("ATT_exact", 1),
      attempt("ATT_duplicate_a", 3),
      attempt("ATT_duplicate_b", 3, "failed"),
      attempt("ATT_stale_active", 4, "running", "2026-01-01T00:00:00.000Z"),
      attempt("ATT_open_terminal", 5, "already_satisfied"),
      attempt("ATT_invalid_ref", null),
      attempt("ATT_orphan", 999),
    ];
    const report = buildShadowParityReport({
      run: { id: "run-shadow", protocol: "shadow", protocol_version: 1, status: "running" },
      claims,
      attempts,
      steps: [
        { identity: "implement", status: "running" },
        { identity: "verify", status: "running" },
      ],
      stories: claims
        .filter((claim) => claim.story_id !== null)
        .map((claim) => ({
          identity: claim.story_id!,
          status: claim.id === 4 ? "failed" : "running",
        })),
      asOf: new Date("2026-07-13T00:00:00.000Z"),
    });
    assert.equal(report.status, "fail");
    assert.equal(report.counts.ignoredSingleStepClaims, 1);
    assert.equal(report.counts.scopedClaims, 5);
    assert.equal(report.counts.attempts, 7);
    assert.deepEqual(
      [...new Set(report.findings.map((finding) => finding.code))].sort(),
      [
        "SHADOW_ATTEMPT_CLAIM_ORPHAN",
        "SHADOW_ATTEMPT_CLAIM_REF_INVALID",
        "SHADOW_ATTEMPT_LEASE_STALE",
        "SHADOW_CLAIM_ATTEMPT_DUPLICATE",
        "SHADOW_CLAIM_ATTEMPT_MISSING",
        "SHADOW_OPEN_CLAIM_TERMINAL_ATTEMPT",
        "SHADOW_TERMINAL_PROCESS_ACTIVE_ATTEMPT",
      ].sort(),
    );
    assert.deepEqual(report.unboundAttemptIds, ["ATT_invalid_ref", "ATT_orphan"]);
  });

  it("reads one exact clean shadow binding without mutating operational state", async () => {
    await database.sql`
      INSERT INTO runs
        (id, run_number, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, activation_preflight_hash)
      VALUES
        ('shadow-parity-clean', 501, 'feature-dev', 'clean parity', 'running',
         'shadow', 1, ${RELEASE_SHA}, ${HASH})
    `;
    await database.sql`
      INSERT INTO steps
        (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
      VALUES
        ('shadow-parity-step', 'shadow-parity-clean', 'implement', 'developer', 1,
         'input', 'output', 'running')
    `;
    await database.sql`
      INSERT INTO stories
        (id, run_id, story_index, story_id, title, status, claimed_by)
      VALUES
        ('shadow-parity-story', 'shadow-parity-clean', 1, 'US-001', 'Story',
         'running', 'developer')
    `;
    const claims = await database.sql<{ id: string }[]>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES ('shadow-parity-clean', 'implement', 'US-001', 'developer')
      RETURNING id::text AS id
    `;
    const claimId = Number(claims[0]?.id);
    await database.sql`
      INSERT INTO execution_attempts
        (attempt_id, run_id, step_id, story_id, generation, fence_token,
         attempt_class, compilation_report_hash,
         source_before_sha, source_before_tree_hash, role, agent_id,
         lease_acquired_at, lease_expires_at, heartbeat_at, disposition, evidence_refs)
      VALUES
        ('ATT_shadow-parity-clean', 'shadow-parity-clean', 'implement', 'US-001', 1,
         ${HASH}, 'product_implementation', ${HASH}, ${RELEASE_SHA}, ${TREE},
         'developer', 'developer', '2026-07-13T00:00:00.000Z',
         '2026-07-14T00:00:00.000Z', '2026-07-13T00:00:00.000Z', 'running',
         ${JSON.stringify([legacyClaimEvidenceRef(claimId)])})
    `;
    const snapshot = async () => database.sql.unsafe(
      `SELECT 'run' AS kind, id, status FROM runs WHERE id = $1
       UNION ALL SELECT 'step', id, status FROM steps WHERE run_id = $1
       UNION ALL SELECT 'story', id, status FROM stories WHERE run_id = $1
       UNION ALL SELECT 'attempt', attempt_id, disposition FROM execution_attempts WHERE run_id = $1
       UNION ALL SELECT 'claim', id::text, COALESCE(outcome, 'open') FROM claim_log WHERE run_id = $1
       ORDER BY kind, id`,
      ["shadow-parity-clean"],
    );
    const before = await snapshot();
    const report = await readShadowParityReport(database.sql, "shadow-parity-clean", {
      asOf: new Date("2026-07-13T01:00:00.000Z"),
    });
    const after = await snapshot();
    assert.deepEqual(after, before);
    assert.ok(report);
    assert.equal(report.status, "pending");
    assert.equal(report.counts.exactBindings, 1);
    assert.equal(report.bindings[0]?.legacyClaimId, claimId);
    assert.equal(report.bindings[0]?.attempts[0]?.attemptId, "ATT_shadow-parity-clean");
  });

  it("passes only after the workflow and its exact claim/attempt pair are terminal", () => {
    const report = buildShadowParityReport({
      run: { id: "run-terminal", protocol: "shadow", protocol_version: 1, status: "completed" },
      claims: [{
        id: 10,
        step_id: "implement",
        story_id: "US-010",
        agent_id: "developer",
        outcome: "completed",
      }],
      attempts: [attempt("ATT_terminal", 10, "produced_delta")],
      steps: [{ identity: "implement", status: "done" }],
      stories: [{ identity: "US-010", status: "verified" }],
      asOf: new Date("2026-07-13T01:00:00.000Z"),
    });
    assert.equal(report.status, "pass");
    assert.equal(report.findings.length, 0);
    assert.equal(report.bindings[0]?.attempts[0]?.attemptClass, "product_implementation");
  });

  it("fails a terminal shadow workflow that produced stories but no parity evidence", () => {
    const report = buildShadowParityReport({
      run: { id: "run-empty", protocol: "shadow", protocol_version: 1, status: "failed" },
      claims: [],
      attempts: [],
      steps: [{ identity: "implement", status: "failed" }],
      stories: [{ identity: "US-001", status: "failed" }],
      asOf: new Date("2026-07-13T01:00:00.000Z"),
    });
    assert.equal(report.status, "fail");
    assert.deepEqual(report.findings, [{ code: "SHADOW_PARITY_EVIDENCE_EMPTY" }]);
  });

  it("returns not_applicable for legacy without reading shadow relations", async () => {
    await database.sql`
      INSERT INTO runs (id, run_number, workflow_id, task, status)
      VALUES ('shadow-parity-legacy', 502, 'feature-dev', 'legacy parity', 'failed')
    `;
    const report = await readShadowParityReport(database.sql, "shadow-parity-legacy", {
      asOf: new Date("2026-07-13T01:00:00.000Z"),
    });
    assert.equal(report?.status, "not_applicable");
    assert.equal(report?.counts.attempts, 0);
    assert.deepEqual(report?.findings, []);
  });

  it("registers the read-only endpoint before the generic run route", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../src/server/dashboard.ts"),
      "utf8",
    );
    const parity = source.indexOf("const shadowParityMatch");
    const routeEnd = source.indexOf("const storiesMatch", parity);
    const generic = source.indexOf("const runMatch =");
    assert.ok(parity >= 0 && routeEnd > parity && generic > routeEnd);
    assert.doesNotMatch(source.slice(parity, routeEnd), /pgRun\(|UPDATE |INSERT |DELETE /);
  });
});
