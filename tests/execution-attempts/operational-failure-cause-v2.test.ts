import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateOperationalFailureCauseAuthorityV1,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1,
} from "../../src/execution/operational-failure-cause-authority-v1.js";
import {
  evaluateOperationalFailureCauseAuthorityV2,
  evaluateOperationalFailureCauseEvidenceAuthorityV2,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2,
} from "../../src/execution/operational-failure-cause-authority-v2.js";
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

describe("OperationalFailureCause authority v2", () => {
  it("adds only the exact DESIGN semantic-closure producer tuple", () => {
    assert.deepEqual(evaluateOperationalFailureCauseAuthorityV1({
      requestedBy: "setfarm.step-fail.single",
      cause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
    }), {
      trusted: false,
      reasonCode: "PRODUCER_TUPLE_UNAUTHORIZED",
    });
    assert.deepEqual(evaluateOperationalFailureCauseAuthorityV2({
      requestedBy: "setfarm.step-fail.single",
      cause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
    }), {
      trusted: true,
      cause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
    });

    for (const input of [
      {
        requestedBy: "setfarm.step-fail.story",
        cause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
      },
      {
        requestedBy: "setfarm.step-fail.single",
        cause: {
          ...DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
          workflowStepId: "setup-build",
        },
      },
      {
        requestedBy: "setfarm.step-fail.single",
        cause: {
          ...DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
          boundary: "product_compiler.design_source.semantic_closure_other",
        },
      },
      {
        requestedBy: "setfarm.step-fail.single",
        cause: {
          ...DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
          failureClass: "generated_artifact_invalid",
        },
      },
      {
        requestedBy: "setfarm.step-fail.single",
        cause: {
          ...DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
          failureCode: "DESIGN_SOURCE_SEMANTIC_CLOSURE_REJECTED_OTHER",
        },
      },
      {
        requestedBy: "setfarm.step-fail.single",
        cause: {
          ...DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
          diagnostic: "caller prose must not join semantic identity",
        },
      },
    ]) {
      assert.equal(
        evaluateOperationalFailureCauseAuthorityV2(input).trusted,
        false,
      );
    }
  });

  it("preserves every v1 authority and its evidence contract", () => {
    assert.deepEqual(evaluateOperationalFailureCauseAuthorityV2({
      requestedBy: "setfarm.step-fail.single",
      cause: EXISTING_V1_CAUSE,
    }), {
      trusted: true,
      cause: EXISTING_V1_CAUSE,
    });
    assert.deepEqual(evaluateOperationalFailureCauseEvidenceAuthorityV2({
      requestedBy: "setfarm.v3-pre-dispatch",
      cause: {
        schema: "setfarm.operational-failure-cause.v1",
        workflowStepId: "implement",
        boundary: "implementation.pre_dispatch.reservation",
        failureClass: "infrastructure_failure",
        failureCode: "SQLSTATE_40001",
      },
      evidence: { errorCode: "40001" },
    }).trusted, true);
    assert.deepEqual(evaluateOperationalFailureCauseEvidenceAuthorityV2({
      requestedBy: "setfarm.v3-pre-dispatch",
      cause: {
        schema: "setfarm.operational-failure-cause.v1",
        workflowStepId: "implement",
        boundary: "implementation.pre_dispatch.reservation",
        failureClass: "infrastructure_failure",
        failureCode: "SQLSTATE_40001",
      },
      evidence: { errorCode: "40P01" },
    }), {
      trusted: false,
      reasonCode: "EVIDENCE_BINDING_INVALID",
    });
  });

  it("keeps the migration-21 v1 registry immutable while extending v2", () => {
    assert.equal(OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1.length, 39);
    assert.equal(
      hashCanonicalJson(OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1),
      "f420432715e094b6b60435b678eb320d553f6d77d33b9716833b4bd07235ad01",
    );
    assert.equal(
      OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2.length,
      OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1.length + 1,
    );
  });
});
