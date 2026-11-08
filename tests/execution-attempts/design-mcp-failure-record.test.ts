import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type postgres from "postgres";

import { requestRunTerminationInTransaction } from "../../src/execution/run-termination.js";
import {
  DESIGN_SOURCE_MCP_ARTIFACT_OPERATIONAL_CAUSE_V1,
  DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
} from "../../src/product-compiler/design-source-runtime-v2.js";
import type { OperationalFailureCauseV1 } from "../../src/execution/schemas/operational-failure-cause-v1.js";
import { OperationalTerminationRequestV1Schema } from "../../src/server/schemas/run-operational-snapshot-v1.js";

import { evaluateOperationalFailureCauseAuthorityV3 } from "../../src/execution/operational-failure-cause-authority-v3.js";
import { evaluateOperationalFailureCauseAuthorityV4 } from "../../src/execution/operational-failure-cause-authority-v4.js";

const REQUESTER = "setfarm.step-fail.single";
const CAUSE = DESIGN_SOURCE_MCP_ARTIFACT_OPERATIONAL_CAUSE_V1;
const crossedTuples: ReadonlyArray<Readonly<{
  label: string; requestedBy: string; cause: OperationalFailureCauseV1;
}>> = [
  { label: "requester", requestedBy: "setfarm.step-ops.stories-completeness", cause: CAUSE },
  { label: "step", requestedBy: REQUESTER, cause: { ...CAUSE, workflowStepId: "setup-build" } },
  { label: "boundary", requestedBy: REQUESTER, cause: { ...CAUSE, boundary: "product_compiler.design_source.resource_prefetch" } },
  { label: "class", requestedBy: REQUESTER, cause: { ...CAUSE, failureClass: "contract_invalid" } },
  { label: "code", requestedBy: REQUESTER, cause: { ...CAUSE, failureCode: "STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED_OTHER" } },
];

// The real request API validates producer authority before its first external
// row read. No SQL responses, transaction, admission result or authority is faked.
async function requestThroughSqlBoundary(requestedBy: string, cause: OperationalFailureCauseV1) {
  const boundary = new Error("DESIGN_MCP_TEST_FIRST_SQL_BOUNDARY");
  const calls: Array<Readonly<{ statement: string; parameters: readonly unknown[] }>> = [];
  const sql = {
    unsafe: async (statement: string, parameters: readonly unknown[]) => {
      calls.push({ statement, parameters });
      throw boundary;
    },
  } as unknown as postgres.TransactionSql;
  let caught: unknown;
  try {
    await requestRunTerminationInTransaction(sql, {
      runId: "RUN_design-mcp-original-failure", targetStatus: "failed", requestedBy,
      diagnostic: "STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED: original sealed infrastructure failure",
      failureCause: cause, now: new Date("2026-11-08T14:00:00.000Z"),
    });
  } catch (error) { caught = error; }
  return { boundary, calls, caught };
}

function terminationProjection(requestedBy = REQUESTER, cause: OperationalFailureCauseV1 = CAUSE) {
  return {
    ref: "setfarm://run-termination/RTR_design-mcp-original-0001",
    requestId: "RTR_design-mcp-original-0001",
    runRef: "setfarm://run/RUN_design-mcp-original-failure",
    targetStatus: "failed", state: "requested", requestedBy,
    diagnostic: "STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED: original sealed infrastructure failure",
    evidence: { operationalFailureCause: cause },
    requestedAt: "2026-11-08T14:00:00.000Z", drainedAt: null, terminalizedAt: null,
    createdAt: "2026-11-08T14:00:00.000Z", updatedAt: "2026-11-08T14:00:00.000Z",
  };
}

describe("design MCP failure record", () => {
  it("admits the exact real DESIGN cause through the termination authority boundary", async () => {
    assert.deepEqual(CAUSE, {
      schema: "setfarm.operational-failure-cause.v1", workflowStepId: "design",
      boundary: "product_compiler.design_source.artifact_download",
      failureClass: "infrastructure_failure", failureCode: "STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED",
    });
    const result = await requestThroughSqlBoundary(REQUESTER, CAUSE);
    assert.equal(result.caught, result.boundary,
      result.caught instanceof Error ? result.caught.message : "Expected the real API to reach its first row read");
    assert.deepEqual(result.calls, [{ statement: "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
      parameters: ["RUN_design-mcp-original-failure"] }]);
  });

  it("rejects crossed producer tuples before any SQL", async () => {
    for (const input of crossedTuples) {
      const result = await requestThroughSqlBoundary(input.requestedBy, input.cause);
      assert.ok(result.caught instanceof Error, input.label);
      assert.equal(result.caught.message,
        "RUN_TERMINATION_FAILURE_CAUSE_AUTHORITY_INVALID:PRODUCER_TUPLE_UNAUTHORIZED", input.label);
      assert.deepEqual(result.calls, [], input.label);
    }
  });

  it("preserves the existing legitimate DESIGN semantic-closure request", async () => {
    const result = await requestThroughSqlBoundary(REQUESTER, DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1);
    assert.equal(result.caught, result.boundary);
    assert.equal(result.calls.length, 1);
  });

  it("projects the exact original failure through the public termination schema", () => {
    const projection = terminationProjection();
    const parsed = OperationalTerminationRequestV1Schema.safeParse(projection);
    assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
    if (parsed.success) assert.deepEqual(parsed.data, projection);
    for (const input of crossedTuples) {
      assert.equal(OperationalTerminationRequestV1Schema.safeParse(
        terminationProjection(input.requestedBy, input.cause)).success, false, input.label);
    }
  });
});

it("DESIGN MCP V4 leaves historical V3 refusal and sibling causes unchanged", () => {
  assert.deepEqual(evaluateOperationalFailureCauseAuthorityV3({ requestedBy: REQUESTER, cause: CAUSE }), {
    trusted: false, reasonCode: "PRODUCER_TUPLE_UNAUTHORIZED",
  });
  assert.deepEqual(evaluateOperationalFailureCauseAuthorityV4({ requestedBy: REQUESTER, cause: CAUSE }), {
    trusted: true, cause: CAUSE,
  });
  for (const failureCode of ["STITCH_ARTIFACT_DOWNLOAD_ACCESS_DENIED", "STITCH_RENDERER_V2_RESOURCE_PREFETCH_FAILED"]) {
    assert.deepEqual(evaluateOperationalFailureCauseAuthorityV4({ requestedBy: REQUESTER,
      cause: { ...CAUSE, failureCode } }), {
      trusted: false, reasonCode: "PRODUCER_TUPLE_UNAUTHORIZED",
    });
  }
});
