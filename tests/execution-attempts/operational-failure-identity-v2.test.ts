import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
  DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
  OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema,
  OperationalFailureIdentityV2Schema,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
  createOperationalFailureIdentityV2,
} from "../../src/execution/schemas/operational-failure-identity-v2.js";
import { operationalFailureCauseHashV1 } from "../../src/execution/schemas/operational-failure-cause-v1.js";

const CAUSE = Object.freeze({
  schema: "setfarm.operational-failure-cause.v1" as const,
  workflowStepId: "design",
  boundary: "product_compiler.design_candidate_authority",
  failureClass: "generated_artifact_invalid" as const,
  failureCode: "V3_DESIGN_CANDIDATE_AUTHORITY_UNRESOLVED",
});

function exactFailure(seed: string) {
  return {
    schema: "setfarm.operational-exact-failure-identity.v2" as const,
    kind: "stitch_target_candidate_selection" as const,
    refKey: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
    artifactType: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
    failureArtifactHash: seed.repeat(64),
    failureFingerprint: String.fromCharCode(seed.charCodeAt(0) + 1).repeat(64),
    candidateSelectionHash: String.fromCharCode(seed.charCodeAt(0) + 2).repeat(64),
  };
}

function designIdentity(seed = "a") {
  return createOperationalFailureIdentityV2({
    requestedBy: DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
    evidenceSchema: DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
    operationalCause: CAUSE,
    exactFailure: exactFailure(seed),
  });
}

describe("operational failure identity v2", () => {
  it("keeps stable cause, exact retry fingerprint, and immutable artifact identity independent", () => {
    const first = designIdentity("a");
    const second = designIdentity("d");

    assert.equal(first.operationalCauseHash, operationalFailureCauseHashV1(CAUSE));
    assert.equal(second.operationalCauseHash, first.operationalCauseHash);
    assert.notEqual(
      first.exactFailure?.failureFingerprint,
      second.exactFailure?.failureFingerprint,
    );
    assert.notEqual(
      first.exactFailure?.failureArtifactHash,
      second.exactFailure?.failureArtifactHash,
    );
    assert.notEqual(
      first.operationalCauseHash,
      first.exactFailure?.failureFingerprint,
    );
    assert.notEqual(
      first.exactFailure?.failureFingerprint,
      first.exactFailure?.failureArtifactHash,
    );
  });

  it("recomputes the cross-project cause hash and rejects tuple drift", () => {
    const valid = designIdentity();
    assert.equal(OperationalFailureIdentityV2Schema.safeParse(valid).success, true);
    assert.equal(OperationalFailureIdentityV2Schema.safeParse({
      ...valid,
      operationalCauseHash: "f".repeat(64),
    }).success, false);
    assert.equal(OperationalFailureIdentityV2Schema.safeParse({
      ...valid,
      evidenceSchema: "setfarm.some-other-evidence.v1",
    }).success, false);
    assert.equal(OperationalFailureIdentityV2Schema.safeParse({
      ...valid,
      exactFailure: null,
    }).success, false);
  });

  it("allows a trusted legacy cause identity without inventing exact artifact authority", () => {
    const cause = {
      schema: "setfarm.operational-failure-cause.v1" as const,
      workflowStepId: "deploy",
      boundary: "product_compiler.deploy_authority",
      failureClass: "platform_authority_invalid" as const,
      failureCode: "V3_DEPLOY_PACKET_INVALID",
    };
    const identity = createOperationalFailureIdentityV2({
      requestedBy: "setfarm.product-compiler.deploy-refusal",
      evidenceSchema: null,
      operationalCause: cause,
      exactFailure: null,
    });
    assert.equal(identity.exactFailure, null);
    assert.equal(identity.operationalCauseHash, operationalFailureCauseHashV1(cause));
  });

  it("binds every design authority outcome to its exact typed cause", () => {
    const base = {
      schema: DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
      terminalFailure: true,
      owner: "compiler",
      outcome: "candidate_authority_unresolved",
      failureRefKey: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
      failureArtifactType: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
      failureArtifactHash: "a".repeat(64),
      failureFingerprint: "b".repeat(64),
      candidateSelectionHash: "c".repeat(64),
      modelRedispatchBudget: 0,
      operationalFailureCause: CAUSE,
    };
    assert.equal(
      OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema.safeParse(base).success,
      true,
    );
    assert.equal(
      OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema.safeParse({
        ...base,
        outcome: "retry_delta_missing",
      }).success,
      false,
    );
    assert.equal(
      OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema.safeParse({
        ...base,
        narrative: "prose cannot alter canonical failure authority",
      }).success,
      false,
    );
  });
});
