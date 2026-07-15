import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OperationalFailureCauseV1Schema,
  normalizeOperationalFailureCodeV1,
  operationalFailureCauseHashV1,
} from "../../src/execution/schemas/operational-failure-cause-v1.js";
import {
  evaluateOperationalFailureCauseAuthorityV1,
  evaluateOperationalFailureCauseEvidenceAuthorityV1,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1,
} from "../../src/execution/operational-failure-cause-authority-v1.js";
import { ClaimEnvelopeV1Schema } from "../../src/execution/schemas/claim-envelope-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  createV3DownstreamTerminalOperationalFailureCauseV1,
  V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1,
} from "../../src/recovery/v3-downstream-terminal-cause-v1.js";

const CAUSE = {
  schema: "setfarm.operational-failure-cause.v1" as const,
  workflowStepId: "setup-build",
  boundary: "stitch.converter.generated_tsx",
  failureClass: "generated_artifact_invalid",
  failureCode: "V3_OBSERVABLE_REF_INVALID",
};

describe("OperationalFailureCause v1", () => {
  it("accepts only the strict semantic producer artifact", () => {
    assert.deepEqual(OperationalFailureCauseV1Schema.parse(CAUSE), CAUSE);
    for (const invalid of [
      { ...CAUSE, diagnostic: "unexpected prose" },
      { ...CAUSE, runId: "run-2039" },
      { ...CAUSE, workflowStepId: "Setup Build" },
      { ...CAUSE, boundary: "stitch/converter" },
      { ...CAUSE, failureClass: "generated-artifact-invalid" },
      { ...CAUSE, failureClass: "generated_artifact_typo" },
      { ...CAUSE, failureCode: "generated_tsx_invalid" },
      { ...CAUSE, failureCode: "A".repeat(161) },
    ]) {
      assert.equal(OperationalFailureCauseV1Schema.safeParse(invalid).success, false);
    }
  });

  it("normalizes only known structural code grammars without inventing prose identity", () => {
    assert.equal(normalizeOperationalFailureCodeV1("V3_PACKET_INVALID"), "V3_PACKET_INVALID");
    assert.equal(normalizeOperationalFailureCodeV1("40P01"), "SQLSTATE_40P01");
    assert.equal(normalizeOperationalFailureCodeV1("ETIMEDOUT"), "ERRNO_ETIMEDOUT");
    assert.equal(normalizeOperationalFailureCodeV1("timeout while opening the repo"), undefined);
    assert.equal(normalizeOperationalFailureCodeV1("INVALID"), undefined);
  });

  it("hashes semantic cause independently from occurrence evidence", () => {
    const firstEvidence = {
      operationalFailureCause: CAUSE,
      runId: "run-2039",
      diagnostic: "first occurrence",
      observedAt: "2026-07-15T00:00:00.000Z",
    };
    const secondEvidence = {
      operationalFailureCause: { ...CAUSE },
      runId: "run-2040",
      diagnostic: "different occurrence",
      observedAt: "2026-07-16T00:00:00.000Z",
    };
    assert.equal(
      operationalFailureCauseHashV1(firstEvidence.operationalFailureCause),
      operationalFailureCauseHashV1(secondEvidence.operationalFailureCause),
    );
    assert.notEqual(
      operationalFailureCauseHashV1(CAUSE),
      operationalFailureCauseHashV1({ ...CAUSE, failureCode: "STITCH_CONTROL_ID_MISSING" }),
    );
  });

  it("trusts only a finite producer-owned requester and semantic tuple", () => {
    assert.deepEqual(
      evaluateOperationalFailureCauseAuthorityV1({
        requestedBy: "setfarm.step-fail.single",
        cause: CAUSE,
      }),
      { trusted: true, cause: CAUSE },
    );
    for (const input of [
      { requestedBy: "agent-prose-classifier", cause: CAUSE },
      { requestedBy: "setfarm.step-fail.single", cause: { ...CAUSE, failureCode: "STITCH_GENERATED_TSX_INVALID" } },
      { requestedBy: "setfarm.step-fail.single", cause: { ...CAUSE, boundary: "product_compiler.plan_refusal" } },
      { requestedBy: "setfarm.product-compiler.plan-refusal", cause: { ...CAUSE, workflowStepId: "plan" } },
    ]) {
      const result = evaluateOperationalFailureCauseAuthorityV1(input);
      assert.equal(result.trusted, false);
    }
  });

  it("does not tighten the pre-existing claim ABI for custom workflow step IDs", () => {
    assert.equal(ClaimEnvelopeV1Schema.parse({
      schema: "setfarm.claim-envelope.v1",
      protocol: "legacy",
      issuedAt: "2026-07-15T12:00:00.000Z",
      stepId: "step-db-custom",
      workflowStepId: "Build_App",
      runId: "run-custom-workflow",
      claimId: 1,
      claimAgentId: "builder",
      runtimeAgentId: "builder",
    }).workflowStepId, "Build_App");
  });

  it("does not grant stage termination authority to an invented workflow step", () => {
    const stageCause = {
      schema: "setfarm.operational-failure-cause.v1" as const,
      workflowStepId: "verify",
      boundary: "stage_context_assembly",
      failureClass: "contract_invalid",
      failureCode: "V3_STAGE_INPUT_UNRESOLVED",
    };
    assert.equal(evaluateOperationalFailureCauseAuthorityV1({
      requestedBy: "setfarm.v3-stage-input-authority",
      cause: stageCause,
    }).trusted, true);
    assert.deepEqual(evaluateOperationalFailureCauseAuthorityV1({
      requestedBy: "setfarm.v3-stage-input-authority",
      cause: { ...stageCause, workflowStepId: "invented-stage" },
    }), {
      trusted: false,
      reasonCode: "PRODUCER_TUPLE_UNAUTHORIZED",
    });
  });

  it("freezes the authority v1 registry embedded by migration 21", () => {
    assert.equal(OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1.length, 39);
    assert.equal(
      hashCanonicalJson(OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1),
      "f420432715e094b6b60435b678eb320d553f6d77d33b9716833b4bd07235ad01",
      "authority changes require a new artifact and migration version",
    );
    assert.equal(V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1.length, 63);
    assert.equal(
      hashCanonicalJson(V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1),
      "22a9f8258924bfb109d6dd74b717f7e177e67db23a7853bc22350b5ba7a5dbd3",
      "reason-to-cause mapping changes require downstream cause v2",
    );
  });

  it("binds semantic producer evidence to the exact repeatable cause", () => {
    const downstreamCause = createV3DownstreamTerminalOperationalFailureCauseV1({
      workflowStepId: "qa-test",
      terminalReasonCodes: ["specification_incomplete", "operator_required"],
    });
    const downstreamEvidence = {
      schema: "setfarm.v3-downstream-termination-evidence.v1",
      outcome: "bounded_recovery_blocked",
      terminalReasonCodes: ["specification_incomplete", "operator_required"],
    };
    assert.equal(evaluateOperationalFailureCauseEvidenceAuthorityV1({
      requestedBy: "setfarm-v3-downstream-compiler",
      cause: downstreamCause,
      evidence: downstreamEvidence,
    }).trusted, true);
    for (const evidence of [
      { ...downstreamEvidence, terminalReasonCodes: ["budget_exhausted"] },
      { ...downstreamEvidence, terminalReasonCodes: ["operator_required", "specification_incomplete"] },
      { ...downstreamEvidence, outcome: "packet_amendment_required" },
      { outcome: "bounded_recovery_blocked", terminalReasonCodes: downstreamEvidence.terminalReasonCodes },
    ]) {
      assert.deepEqual(evaluateOperationalFailureCauseEvidenceAuthorityV1({
        requestedBy: "setfarm-v3-downstream-compiler",
        cause: downstreamCause,
        evidence,
      }), { trusted: false, reasonCode: "EVIDENCE_BINDING_INVALID" });
    }

    const deployCause = {
      schema: "setfarm.operational-failure-cause.v1" as const,
      workflowStepId: "deploy",
      boundary: "product_compiler.deploy_authority",
      failureClass: "contract_invalid",
      failureCode: "V3_DEPLOY_PACKET_INVALID",
    };
    assert.equal(evaluateOperationalFailureCauseEvidenceAuthorityV1({
      requestedBy: "setfarm.product-compiler.deploy-refusal",
      cause: deployCause,
      evidence: {
        schema: "setfarm.v3-deploy-authority-termination.v1",
        authorityCode: "V3_DEPLOY_PACKET_INVALID",
      },
    }).trusted, true);
    assert.equal(evaluateOperationalFailureCauseEvidenceAuthorityV1({
      requestedBy: "setfarm.product-compiler.deploy-refusal",
      cause: deployCause,
      evidence: {
        schema: "setfarm.v3-deploy-authority-termination.v1",
        authorityCode: "V3_DEPLOY_SOURCE_UNAVAILABLE",
      },
    }).trusted, false);

    const preDispatchCause = {
      schema: "setfarm.operational-failure-cause.v1" as const,
      workflowStepId: "implement",
      boundary: "implementation.pre_dispatch.reservation",
      failureClass: "infrastructure_failure",
      failureCode: "SQLSTATE_40001",
    };
    assert.equal(evaluateOperationalFailureCauseEvidenceAuthorityV1({
      requestedBy: "setfarm.v3-pre-dispatch",
      cause: preDispatchCause,
      evidence: { errorCode: "40001" },
    }).trusted, true);
    assert.equal(evaluateOperationalFailureCauseEvidenceAuthorityV1({
      requestedBy: "setfarm.v3-pre-dispatch",
      cause: preDispatchCause,
      evidence: { errorCode: "40P01" },
    }).trusted, false);
  });
});
