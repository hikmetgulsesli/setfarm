import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateOperationalFailureCauseAuthorityV1,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1,
} from "../../src/execution/operational-failure-cause-authority-v1.js";
import {
  evaluateOperationalFailureCauseAuthorityV2,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV2,
} from "../../src/execution/operational-failure-cause-authority-v2.js";
import {
  evaluateOperationalFailureCauseAuthorityV3,
  evaluateOperationalFailureCauseEvidenceAuthorityV3,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V3,
  operationalFailureCauseAuthoritySqlPredicateV3,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV3,
} from "../../src/execution/operational-failure-cause-authority-v3.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
} from "../../src/product-compiler/design-source-runtime-v2.js";

const EXISTING_V1_CAUSE = Object.freeze({
  schema: "setfarm.operational-failure-cause.v1" as const,
  workflowStepId: "setup-build",
  boundary: "stitch.converter.generated_tsx",
  failureClass: "generated_artifact_invalid" as const,
  failureCode: "V3_OBSERVABLE_REF_INVALID",
});

const SETUP_BUILD_PACKET_CAUSES = Object.freeze([
  Object.freeze({
    schema: "setfarm.operational-failure-cause.v1" as const,
    workflowStepId: "setup-build",
    boundary: "product_compiler.setup_build_packet",
    failureClass: "contract_invalid" as const,
    failureCode: "SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED",
  }),
  Object.freeze({
    schema: "setfarm.operational-failure-cause.v1" as const,
    workflowStepId: "setup-build",
    boundary: "product_compiler.setup_build_packet",
    failureClass: "contract_invalid" as const,
    failureCode: "SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED",
  }),
  Object.freeze({
    schema: "setfarm.operational-failure-cause.v1" as const,
    workflowStepId: "setup-build",
    boundary: "product_compiler.setup_build_packet",
    failureClass: "contract_invalid" as const,
    failureCode: "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED",
  }),
]);

describe("OperationalFailureCause authority v3", () => {
  it("authorizes only the three current setup-build packet tuples", () => {
    for (const cause of SETUP_BUILD_PACKET_CAUSES) {
      assert.deepEqual(evaluateOperationalFailureCauseAuthorityV2({
        requestedBy: "setfarm.step-fail.single",
        cause,
      }), {
        trusted: false,
        reasonCode: "PRODUCER_TUPLE_UNAUTHORIZED",
      });
      assert.deepEqual(evaluateOperationalFailureCauseAuthorityV3({
        requestedBy: "setfarm.step-fail.single",
        cause,
      }), {
        trusted: true,
        cause,
      });

      for (const input of [
        { requestedBy: "setfarm.step-fail.story", cause },
        {
          requestedBy: "setfarm.step-fail.single",
          cause: { ...cause, workflowStepId: "design" },
        },
        {
          requestedBy: "setfarm.step-fail.single",
          cause: { ...cause, boundary: "product_compiler.setup_build_packet_other" },
        },
        {
          requestedBy: "setfarm.step-fail.single",
          cause: { ...cause, failureClass: "generated_artifact_invalid" },
        },
        {
          requestedBy: "setfarm.step-fail.single",
          cause: { ...cause, failureCode: `${cause.failureCode}_OTHER` },
        },
        {
          requestedBy: "setfarm.step-fail.single",
          cause: { ...cause, diagnostic: "caller prose cannot join cause identity" },
        },
      ]) {
        assert.equal(evaluateOperationalFailureCauseAuthorityV3(input).trusted, false);
      }
    }
  });

  it("preserves the frozen v1 and v2 identities", () => {
    assert.deepEqual(evaluateOperationalFailureCauseAuthorityV3({
      requestedBy: "setfarm.step-fail.single",
      cause: EXISTING_V1_CAUSE,
    }), {
      trusted: true,
      cause: EXISTING_V1_CAUSE,
    });
    assert.deepEqual(evaluateOperationalFailureCauseAuthorityV3({
      requestedBy: "setfarm.step-fail.single",
      cause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
    }), {
      trusted: true,
      cause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
    });
    assert.equal(OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1.length, 39);
    assert.equal(
      hashCanonicalJson(OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1),
      "f420432715e094b6b60435b678eb320d553f6d77d33b9716833b4bd07235ad01",
    );
    assert.equal(
      OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2.length,
      OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1.length + 1,
    );
    assert.equal(
      OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V3.length,
      OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2.length + 1,
    );
  });

  it("delegates v2 evidence rules and gives new packet tuples no supplemental contract", () => {
    const v1EvidenceCause = {
      schema: "setfarm.operational-failure-cause.v1" as const,
      workflowStepId: "implement",
      boundary: "implementation.pre_dispatch.reservation",
      failureClass: "infrastructure_failure" as const,
      failureCode: "SQLSTATE_40001",
    };
    assert.deepEqual(evaluateOperationalFailureCauseEvidenceAuthorityV3({
      requestedBy: "setfarm.v3-pre-dispatch",
      cause: v1EvidenceCause,
      evidence: { errorCode: "40P01" },
    }), {
      trusted: false,
      reasonCode: "EVIDENCE_BINDING_INVALID",
    });
    assert.deepEqual(evaluateOperationalFailureCauseEvidenceAuthorityV3({
      requestedBy: "setfarm.step-fail.single",
      cause: SETUP_BUILD_PACKET_CAUSES[0],
      evidence: { packetDiagnostic: "untrusted occurrence detail" },
    }), {
      trusted: true,
      cause: SETUP_BUILD_PACKET_CAUSES[0],
    });
  });

  it("extends the v2 SQL authority without changing its evidence predicate", () => {
    const input = {
      requestedBySql: "requested_by",
      evidenceSql: "evidence",
      causeSql: "failure_cause",
    };
    const predicate = operationalFailureCauseAuthoritySqlPredicateV3(input);
    for (const cause of SETUP_BUILD_PACKET_CAUSES) {
      assert.match(predicate, new RegExp(cause.failureCode));
    }
    assert.equal(
      operationalFailureCauseEvidenceAuthoritySqlPredicateV3(input),
      operationalFailureCauseEvidenceAuthoritySqlPredicateV2(input),
    );
  });
});
