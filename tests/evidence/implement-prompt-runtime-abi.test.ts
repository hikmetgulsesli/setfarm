import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import {
  createV3ImplementationClaimHandoffV1,
  createV3ImplementationContextV1,
} from "../../src/execution/v3-implementation-handoff.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

describe("v3 implement context runtime ABI", () => {
  it("requires the canonical browser state/action bridge in the sole structured authority", () => {
    const producer = {
      pass: "runtime-abi-test",
      codeSha: "5840ae3",
      toolVersions: { setfarm: "test" },
    } as const;
    const slice = ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
    const sliceHash = hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.implementation-slice.v1",
      producer,
      payload: slice,
    });
    const evidencePlan = compileEvidencePlanV1({ slice, sliceHash });
    const evidencePlanArtifactHash = hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.evidence-plan.v1",
      producer,
      payload: evidencePlan,
    });
    const handoff = createV3ImplementationClaimHandoffV1({
      schema: "setfarm.v3-implementation-claim-handoff.v1",
      protocol: "v3",
      runId: "run-runtime-abi",
      stepId: "step-runtime-abi",
      storyId: slice.storyId,
      storyDbId: "story-runtime-abi",
      claimId: 1,
      attemptId: "ATT_runtime-abi-00000001",
      attemptGeneration: 1,
      branch: "runtime-abi",
      workdir: "/tmp/setfarm-runtime-abi",
      packetHash: slice.packetHash,
      compilationReportHash: "9".repeat(64),
      sliceHash,
      sliceRef: `SLICE_US_001_${sliceHash.slice(0, 16).toUpperCase()}`,
      evidencePlanHash: evidencePlan.planHash,
      evidencePlanArtifactHash,
      evidencePlanRef: `EVIDENCE_PLAN_US_001_${evidencePlanArtifactHash.slice(0, 16).toUpperCase()}`,
      executionAuthority: { role: "developer", attemptClass: "product_implementation" },
      sourceBefore: {
        sha: slice.sourceRevision.baseSha,
        treeHash: slice.sourceRevision.treeHash,
      },
      artifactProducer: producer,
      implementationSlice: slice,
      evidencePlan,
    });
    const authority = JSON.stringify(createV3ImplementationContextV1({ handoff }));

    assert.match(authority, /runtimeEvidence\.adapter is browser-service/);
    assert.match(authority, /capture\.globalName/);
    assert.match(authority, /stateBindings pointer/);
    assert.match(authority, /capture\.actionInvocation/);
    assert.match(authority, /same application action logic/);
    assert.match(authority, /capture\.scenarioMode before boot/);
    assert.match(authority, /manual mode may suspend automatic system\/timer dispatch/);
    assert.match(authority, /Never substitute window\.app or a second mock state machine/);
  });
});
