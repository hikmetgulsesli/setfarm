import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  claimBoundStepCompleteStdinTransportV1,
  createAgentToolPolicyV1,
  legacyOutputFileTransportV1,
  type AgentToolPolicyProfile,
} from "../../src/execution/agent-tool-policy.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import {
  createV3StageClaimHandoffV1,
  V3StageClaimHandoffV1Schema,
} from "../../src/execution/v3-stage-execution-context.js";
import {
  createV3StageFailureV1,
  createV3StageRetrySourceV1,
  recoverV3StageFailureV1,
  serializeV3StageFailureDiagnostic,
  V3_STAGE_FAILURE_MAX_BYTES,
  V3_STAGE_FAILURE_TRANSPORT_MAX_BYTES,
  V3StageRetryDirectiveV1Schema,
} from "../../src/execution/v3-stage-retry-authority.js";

function envelope(overrides: Partial<ClaimEnvelopeV1> = {}): ClaimEnvelopeV1 {
  return {
    schema: "setfarm.claim-envelope.v1",
    protocol: "v3",
    issuedAt: "2026-07-15T00:00:00.000Z",
    stepId: "step-plan-1",
    workflowStepId: "plan",
    runId: "run-stage-1",
    claimId: 41,
    claimGeneration: 3,
    claimAgentId: "feature-dev_planner",
    runtimeAgentId: "feature-dev_planner",
    workdir: "/tmp/setfarm-stage-workdir",
    repo: "/tmp/setfarm-stage-workdir",
    ...overrides,
  };
}

const STAGE_TOOL_POLICY_CASES = [
  ["bug-fix", "triage", "triager", "artifact-only"],
  ["bug-fix", "investigate", "investigator", "artifact-only"],
  ["bug-fix", "setup", "setup", "workspace-bootstrap"],
  ["bug-fix", "fix", "fixer", "source-scoped"],
  ["bug-fix", "verify", "verifier", "verification"],
  ["bug-fix", "pr", "pr", "repository-operator"],
  ["daily-standup", "collect", "collector", "artifact-only"],
  ["daily-standup", "report", "reporter", "artifact-only"],
  ["feature-dev", "plan", "planner", "artifact-only"],
  ["feature-dev", "design", "designer", "artifact-only"],
  ["feature-dev", "stories", "planner", "artifact-only"],
  ["feature-dev", "setup-repo", "setup-repo", "workspace-bootstrap"],
  ["feature-dev", "setup-build", "setup-build", "workspace-bootstrap"],
  ["feature-dev", "implement", "developer", "source-scoped"],
  ["feature-dev", "verify", "reviewer", "verification"],
  ["feature-dev", "supervise", "supervisor", "source-scoped"],
  ["feature-dev", "security-gate", "security-gate", "scanner"],
  ["feature-dev", "qa-test", "qa-tester", "browser-verification"],
  ["feature-dev", "final-test", "tester", "browser-verification"],
  ["feature-dev", "deploy", "deployer", "platform-operator"],
  ["security-audit", "scan", "scanner", "scanner"],
  ["security-audit", "prioritize", "prioritizer", "artifact-only"],
  ["security-audit", "setup", "setup", "workspace-bootstrap"],
  ["security-audit", "fix", "fixer", "source-scoped"],
  ["security-audit", "verify", "verifier", "verification"],
  ["security-audit", "test", "tester", "browser-verification"],
  ["security-audit", "pr", "pr", "repository-operator"],
  ["ui-refactor", "plan", "planner", "artifact-only"],
  ["ui-refactor", "setup", "setup", "workspace-bootstrap"],
  ["ui-refactor", "implement", "developer", "source-scoped"],
  ["ui-refactor", "verify", "verifier", "verification"],
  ["ui-refactor", "final-test", "tester", "browser-verification"],
] as const satisfies ReadonlyArray<readonly [string, string, string, AgentToolPolicyProfile]>;

describe("v3 stage execution context", () => {
  it("binds exact instruction bytes, claim identity, paths, and completion authority", () => {
    const instructionContent = [
      "PLAN v3 - typed ProductSpec proposal",
      "",
      "## Exact task",
      "Build a status utility at /status.",
    ].join("\n");
    const handoff = createV3StageClaimHandoffV1({
      claimEnvelope: envelope(),
      workflow: "feature-dev",
      role: "planner",
      workdir: "/tmp/setfarm-stage-workdir",
      outputFile: "/tmp/setfarm-stage-output.txt",
      instructionContent,
    });

    assert.equal(handoff.schema, "setfarm.v3-stage-claim-handoff.v1");
    assert.equal(handoff.context.schema, "setfarm.v3-stage-execution-context.v1");
    assert.equal(handoff.context.workflowStepId, "plan");
    assert.equal(handoff.context.claim.claimId, 41);
    assert.equal(handoff.context.claim.claimGeneration, 3);
    assert.equal(
      handoff.context.instruction.path,
      "/tmp/setfarm-stage-workdir/.setfarm/stage-executions/claim-41/stage-instruction.md",
    );
    assert.equal(handoff.context.completion.outputFile, "/tmp/setfarm-stage-output.txt");
    assert.equal(handoff.context.completion.outputFileAuthority, "legacy_compatibility_only");
    assert.equal(handoff.context.toolPolicy.profile, "artifact-only");
    assert.equal(handoff.context.toolPolicy.toolAuthority.filesystemMutation.scope, "none");
    assert.match(handoff.context.toolPolicy.policyHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      handoff.context.toolPolicy.artifactSubmission.transport,
      claimBoundStepCompleteStdinTransportV1(),
    );
    assert.equal(
      handoff.context.instruction.artifactHash,
      createHash("sha256").update(Buffer.from(instructionContent, "utf8")).digest("hex"),
    );
    assert.equal(handoff.instructionContent, instructionContent);
    assert.equal(V3StageClaimHandoffV1Schema.safeParse(handoff).success, true);

    const concurrentClaim = createV3StageClaimHandoffV1({
      claimEnvelope: envelope({ claimId: 42 }),
      workflow: "feature-dev",
      role: "planner",
      workdir: "/tmp/setfarm-stage-workdir",
      outputFile: "/tmp/setfarm-stage-output-2.txt",
      instructionContent,
    });
    assert.notEqual(concurrentClaim.context.instruction.path, handoff.context.instruction.path);
    assert.match(concurrentClaim.context.instruction.path, /\/claim-42\/stage-instruction\.md$/);
  });

  it("rejects instruction or manifest drift after the handoff is sealed", () => {
    const handoff = createV3StageClaimHandoffV1({
      claimEnvelope: envelope(),
      workflow: "feature-dev",
      role: "planner",
      workdir: "/tmp/setfarm-stage-workdir",
      outputFile: "/tmp/setfarm-stage-output.txt",
      instructionContent: "Exact PLAN instruction",
    });

    const changedInstruction = structuredClone(handoff);
    changedInstruction.instructionContent = "Different PLAN instruction";
    assert.equal(V3StageClaimHandoffV1Schema.safeParse(changedInstruction).success, false);

    const changedContext = structuredClone(handoff);
    changedContext.context.role = "designer";
    assert.equal(V3StageClaimHandoffV1Schema.safeParse(changedContext).success, false);

    const changedPolicy = structuredClone(handoff);
    changedPolicy.context.toolPolicy.policyHash = "f".repeat(64);
    assert.equal(V3StageClaimHandoffV1Schema.safeParse(changedPolicy).success, false);
  });

  it("maps every bundled workflow stage authority to one exact canonical tool profile", () => {
    STAGE_TOOL_POLICY_CASES.forEach(([workflow, workflowStepId, role, profile], index) => {
      const claimAgentId = `${workflow}_${role}`;
      const handoff = createV3StageClaimHandoffV1({
        claimEnvelope: envelope({
          stepId: `step-${workflowStepId}-${index}`,
          workflowStepId,
          claimId: 100 + index,
          claimAgentId,
          runtimeAgentId: claimAgentId,
        }),
        workflow,
        role,
        workdir: "/tmp/setfarm-stage-workdir",
        outputFile: `/tmp/setfarm-stage-output-${index}.txt`,
        instructionContent: `Execute ${workflow}/${workflowStepId}/${role}`,
      });

      assert.equal(handoff.context.toolPolicy.profile, profile);
      assert.equal(
        handoff.context.toolPolicy.artifactSubmission.transport.kind,
        "claim-bound-step-complete-stdin",
      );
      assert.equal(V3StageClaimHandoffV1Schema.safeParse(handoff).success, true);
    });
  });

  it("fails closed for unknown or mismatched stage tool authority", () => {
    assert.throws(
      () => createV3StageClaimHandoffV1({
        claimEnvelope: envelope({ workflowStepId: "unknown-stage" }),
        workflow: "feature-dev",
        role: "planner",
        workdir: "/tmp/setfarm-stage-workdir",
        outputFile: "/tmp/setfarm-stage-output.txt",
        instructionContent: "Unknown stage must not inherit authority.",
      }),
      /V3_STAGE_TOOL_POLICY_MAPPING_MISSING/,
    );

    const wrongPolicy = createAgentToolPolicyV1({
      profile: "verification",
      outputTransport: claimBoundStepCompleteStdinTransportV1(),
    });
    assert.throws(
      () => createV3StageClaimHandoffV1({
        claimEnvelope: envelope(),
        workflow: "feature-dev",
        role: "planner",
        workdir: "/tmp/setfarm-stage-workdir",
        outputFile: "/tmp/setfarm-stage-output.txt",
        instructionContent: "Supplied policy must match exact stage authority.",
        toolPolicy: wrongPolicy,
      }),
      /V3_STAGE_TOOL_POLICY_MISMATCH/,
    );

    const expectedPolicy = createAgentToolPolicyV1({
      profile: "artifact-only",
      outputTransport: claimBoundStepCompleteStdinTransportV1(),
    });
    const handoff = createV3StageClaimHandoffV1({
      claimEnvelope: envelope(),
      workflow: "feature-dev",
      role: "planner",
      workdir: "/tmp/setfarm-stage-workdir",
      outputFile: "/tmp/setfarm-stage-output.txt",
      instructionContent: "Exact supplied policy is accepted.",
      toolPolicy: expectedPolicy,
    });
    assert.equal(handoff.context.toolPolicy.policyHash, expectedPolicy.policyHash);
  });

  it("keeps output-file submission behind an explicit exact-path compatibility transport", () => {
    const outputFile = "/tmp/setfarm-stage-output.txt";
    const handoff = createV3StageClaimHandoffV1({
      claimEnvelope: envelope(),
      workflow: "feature-dev",
      role: "planner",
      workdir: "/tmp/setfarm-stage-workdir",
      outputFile,
      outputTransport: legacyOutputFileTransportV1(outputFile),
      instructionContent: "Use explicit legacy compatibility transport.",
    });
    assert.deepEqual(
      handoff.context.toolPolicy.artifactSubmission.transport,
      legacyOutputFileTransportV1(outputFile),
    );

    assert.throws(
      () => createV3StageClaimHandoffV1({
        claimEnvelope: envelope(),
        workflow: "feature-dev",
        role: "planner",
        workdir: "/tmp/setfarm-stage-workdir",
        outputFile,
        outputTransport: legacyOutputFileTransportV1("/tmp/different-stage-output.txt"),
        instructionContent: "Legacy transport cannot drift from compatibility path.",
      }),
      /V3_STAGE_LEGACY_OUTPUT_FILE_MISMATCH/,
    );
  });

  it("binds story and attempt identity without exposing the completion fence token", () => {
    const handoff = createV3StageClaimHandoffV1({
      claimEnvelope: envelope({
        workflowStepId: "verify",
        claimAgentId: "feature-dev_reviewer",
        runtimeAgentId: "feature-dev_reviewer",
        storyId: "US-001",
        storyDbId: "story-db-1",
        attempt: {
          attemptId: "ATT_00000000-0000-0000-0000-000000000001",
          generation: 2,
          fenceToken: "a".repeat(64),
        },
      }),
      workflow: "feature-dev",
      role: "reviewer",
      workdir: "/tmp/setfarm-stage-workdir",
      outputFile: "/tmp/setfarm-stage-output.txt",
      instructionContent: "Verify the exact story evidence.",
    });

    assert.deepEqual(handoff.context.story, {
      storyId: "US-001",
      storyDbId: "story-db-1",
      attemptId: "ATT_00000000-0000-0000-0000-000000000001",
      attemptGeneration: 2,
    });
    assert.doesNotMatch(JSON.stringify(handoff.context), /fenceToken/);
  });

  it("binds exact previous output, typed diagnostics, source state, and expected delta on retry", () => {
    const instructionContent = "PLAN v3 - typed ProductSpec proposal\n\nReturn exact typed output.";
    const previousOutputContent = [
      "STATUS: done",
      "PRD:",
      "```product-spec-v1",
      "{\"schema\":\"setfarm.product-spec.v1\",\"actions\":[{\"stateDeltas\":[{\"path\":\"value\"}]}]}",
      "```",
    ].join("\n");
    const failure = createV3StageFailureV1({
      workflowStepId: "plan",
      kind: "output_contract_invalid",
      diagnostics: [{
        code: "PRODUCT_SPEC_PROPOSAL_SCHEMA_INVALID",
        path: "/actions/0/stateDeltas/0/path",
        message: "Invalid input: expected array, received string",
        reference: "CAP_BROWSER_INTERACTION",
      }],
    });
    const retrySource = createV3StageRetrySourceV1({
      workflowStepId: "plan",
      retryOrdinal: 1,
      maxRetries: 2,
      previousClaimId: 40,
      previousInstructionContent: instructionContent,
      previousOutputContent,
      diagnostic: serializeV3StageFailureDiagnostic("V3_PLAN_OUTPUT_REJECTED", failure),
    });
    const handoff = createV3StageClaimHandoffV1({
      claimEnvelope: envelope(),
      workflow: "feature-dev",
      role: "planner",
      workdir: "/tmp/setfarm-stage-workdir",
      outputFile: "/tmp/setfarm-stage-output.txt",
      instructionContent,
      retrySource,
    });

    assert.equal(handoff.context.retry?.schema, "setfarm.v3-stage-retry-directive.v1");
    assert.equal(handoff.context.retry?.previousClaimId, 40);
    assert.equal(handoff.context.retry?.sourceState.disposition, "instruction_unchanged");
    assert.equal(handoff.context.retry?.failure.failureHash, failure.failureHash);
    assert.equal(
      handoff.context.retry?.failure.diagnostics[0]?.message,
      "Invalid input: expected array, received string",
    );
    assert.equal(
      handoff.context.retry?.failure.diagnostics[0]?.reference,
      "CAP_BROWSER_INTERACTION",
    );
    assert.equal(
      handoff.context.retry?.previousOutput.path,
      "/tmp/setfarm-stage-workdir/.setfarm/stage-executions/claim-41/previous-output.txt",
    );
    assert.equal(
      handoff.context.retry?.expectedDelta.baseOutputHash,
      createHash("sha256").update(Buffer.from(previousOutputContent, "utf8")).digest("hex"),
    );
    assert.equal(handoff.context.retry?.expectedDelta.mustChangeOutputHash, true);
    assert.equal(handoff.previousOutputContent, previousOutputContent);
    assert.equal(V3StageRetryDirectiveV1Schema.safeParse(handoff.context.retry).success, true);
    assert.equal(V3StageClaimHandoffV1Schema.safeParse(handoff).success, true);

    const repeatedSource = createV3StageRetrySourceV1({
      workflowStepId: "plan",
      retryOrdinal: 2,
      maxRetries: 2,
      previousClaimId: 41,
      previousInstructionContent: instructionContent,
      previousOutputContent,
      diagnostic: serializeV3StageFailureDiagnostic("V3_PLAN_OUTPUT_REJECTED", failure),
    });
    const repeatedHandoff = createV3StageClaimHandoffV1({
      claimEnvelope: envelope({ claimId: 42 }),
      workflow: "feature-dev",
      role: "planner",
      workdir: "/tmp/setfarm-stage-workdir",
      outputFile: "/tmp/setfarm-stage-output-2.txt",
      instructionContent,
      retrySource: repeatedSource,
    });
    assert.equal(
      repeatedHandoff.context.retry?.dedupeKey,
      handoff.context.retry?.dedupeKey,
      "claim IDs and retry ordinals must not disguise an unchanged retry tuple",
    );

    const changedPreviousOutput = structuredClone(handoff);
    changedPreviousOutput.previousOutputContent += "\nchanged";
    assert.equal(V3StageClaimHandoffV1Schema.safeParse(changedPreviousOutput).success, false);

    const malformedLongTransport = recoverV3StageFailureV1({
      workflowStepId: "plan",
      diagnostic: `${"x".repeat(8_000)}V3_STAGE_FAILURE_V1:{broken`,
    });
    assert.equal(malformedLongTransport.kind, "unstructured_legacy_failure");
    assert.equal(malformedLongTransport.diagnostics[0]?.message.length, 4_000);

    const oversizedFailure = createV3StageFailureV1({
      workflowStepId: "plan",
      kind: "output_contract_invalid",
      diagnostics: Array.from({ length: 20 }, (_, index) => ({
        code: `DIAGNOSTIC_${index}_${"c".repeat(480)}`,
        path: `/${index}/${"p".repeat(3_900)}`,
        message: `message-${index}-${"m".repeat(3_900)}`,
      })),
    });
    const oversizedTransport = serializeV3StageFailureDiagnostic(
      "V3_PLAN_OUTPUT_REJECTED",
      oversizedFailure,
    );
    assert.ok(Buffer.byteLength(JSON.stringify(oversizedFailure), "utf8") <= V3_STAGE_FAILURE_MAX_BYTES);
    assert.ok(Buffer.byteLength(oversizedTransport, "utf8") <= V3_STAGE_FAILURE_TRANSPORT_MAX_BYTES);
    assert.equal(
      recoverV3StageFailureV1({ workflowStepId: "plan", diagnostic: oversizedTransport }).failureHash,
      oversizedFailure.failureHash,
    );
  });
});
