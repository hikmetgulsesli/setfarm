import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { ClaimEnvelopeV1Schema } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createOperationalRetryDirectiveV1 } from "../../src/execution/operational-retry-directive.js";
import {
  assertV3ImplementationContextCapacity,
  createV3ImplementationClaimHandoffV1,
  createV3ImplementationContextV1,
  serializeV3ImplementationContextV1,
  V3_IMPLEMENTATION_CONTEXT_MAX_BYTES,
  V3ImplementationClaimHandoffV1Schema,
  V3ImplementationContextCapacityError,
  V3ImplementationContextV1Schema,
} from "../../src/execution/v3-implementation-handoff.js";
import { implementModule } from "../../src/installer/steps/06-implement/module.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  buildClaimSummary,
  buildPreclaimedPrompt,
  buildResolvedClaimBootstrapScript,
} from "../../src/spawner-prompt.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const RUN_ID = "run-v3-handoff-001";
const STEP_ID = "step-db-v3-handoff-001";
const STORY_DB_ID = "story-db-v3-handoff-001";
const CLAIM_ID = 901;
const ATTEMPT_ID = "ATT_00000000-0000-0000-0000-000000000901";
const COMPILATION_REPORT_HASH = "9".repeat(64);
const FENCE_TOKEN = "7".repeat(64);
const ARTIFACT_PRODUCER = Object.freeze({
  pass: "v3-handoff-test",
  codeSha: "5840ae3",
  toolVersions: { setfarm: "test" },
});

function fixture(workdir: string) {
  const values = buildMinimalValidContracts();
  const slice = ImplementationSliceV1Schema.parse(values.implementationSlice);
  const sliceHash = hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: "setfarm.implementation-slice.v1",
    producer: ARTIFACT_PRODUCER,
    payload: slice,
  });
  const evidencePlan = compileEvidencePlanV1({ slice, sliceHash });
  const evidencePlanArtifactHash = hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: "setfarm.evidence-plan.v1",
    producer: ARTIFACT_PRODUCER,
    payload: evidencePlan,
  });
  const handoff = createV3ImplementationClaimHandoffV1({
    schema: "setfarm.v3-implementation-claim-handoff.v1",
    protocol: "v3",
    runId: RUN_ID,
    stepId: STEP_ID,
    storyId: slice.storyId,
    storyDbId: STORY_DB_ID,
    claimId: CLAIM_ID,
    attemptId: ATTEMPT_ID,
    attemptGeneration: 1,
    branch: "run-v3-us-001",
    workdir,
    packetHash: slice.packetHash,
    compilationReportHash: COMPILATION_REPORT_HASH,
    sliceHash,
    sliceRef: `SLICE_US_001_${sliceHash.slice(0, 16).toUpperCase()}`,
    evidencePlanHash: evidencePlan.planHash,
    evidencePlanArtifactHash,
    evidencePlanRef: `EVIDENCE_PLAN_US_001_${evidencePlanArtifactHash.slice(0, 16).toUpperCase()}`,
    executionAuthority: {
      role: "developer",
      attemptClass: "product_implementation",
    },
    sourceBefore: {
      sha: slice.sourceRevision.baseSha,
      treeHash: slice.sourceRevision.treeHash,
    },
    artifactProducer: ARTIFACT_PRODUCER,
    implementationSlice: slice,
    evidencePlan,
  });
  const claimEnvelope = ClaimEnvelopeV1Schema.parse({
    schema: "setfarm.claim-envelope.v1",
    protocol: "v3",
    issuedAt: "2026-07-13T00:00:00.000Z",
    stepId: STEP_ID,
    workflowStepId: "implement",
    runId: RUN_ID,
    storyId: slice.storyId,
    storyDbId: STORY_DB_ID,
    claimId: CLAIM_ID,
    claimAgentId: "feature-dev_developer",
    runtimeAgentId: "developer",
    claimGeneration: 1,
    attempt: { attemptId: ATTEMPT_ID, generation: 1, fenceToken: FENCE_TOKEN },
    workdir,
    repo: workdir,
  });
  const rawPrompt = implementModule.buildPrompt({
    runId: RUN_ID,
    task: slice.story.description,
    context: {
      RUN_ID,
      STORY_ID: slice.storyId,
      STORY_BRANCH: handoff.branch,
      STORY_WORKDIR: workdir,
      product_build_packet_hash: handoff.packetHash,
      implementation_slice_hash: handoff.sliceHash,
      implementation_slice_ref: handoff.sliceRef,
      product_compilation_report_hash: handoff.compilationReportHash,
      evidence_plan_hash: handoff.evidencePlanHash,
      evidence_plan_artifact_hash: handoff.evidencePlanArtifactHash,
      evidence_plan_ref: handoff.evidencePlanRef,
      implementation_context_protocol: "v3",
    },
  });
  return { handoff, claimEnvelope, rawPrompt };
}

describe("Product Compiler v3 implementation handoff", () => {
  it("carries the exact compiler objects through claim summary and bootstrap without prose parsing", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-handoff-"));
    try {
      const workdir = path.join(root, "worktree");
      fs.mkdirSync(path.join(workdir, "src"), { recursive: true });
      fs.writeFileSync(path.join(workdir, "src", "App.tsx"), "export const App = () => null;\n");
      const { handoff, claimEnvelope, rawPrompt } = fixture(workdir);
      assert.match(rawPrompt, /Product Compiler v3 Implementation Claim Locator/);
      assert.match(rawPrompt, /setfarm\.implementation-context\.v3 file is the sole canonical implementation authority/);
      assert.doesNotMatch(rawPrompt, /BEGIN_CANONICAL_IMPLEMENTATION_SLICE_V1/);
      assert.doesNotMatch(rawPrompt, /BEGIN_CANONICAL_EVIDENCE_PLAN_V1|STATUS: done/);

      const claimFile = path.join(root, "claim.json");
      const claimSummaryFile = path.join(root, "claim-summary.json");
      const outputFile = path.join(root, "output.txt");
      const bootstrapFile = path.join(root, "bootstrap.sh");
      fs.writeFileSync(claimFile, `${JSON.stringify(claimEnvelope)}\n`);
      const summary = buildClaimSummary({
        wfId: "feature-dev",
        role: "developer",
        claimFile,
        outputFile,
        bootstrapFile,
        stepId: STEP_ID,
        runId: RUN_ID,
        workdir,
        repo: workdir,
        storyId: "US-001",
        claimEnvelope,
        v3ImplementationHandoff: handoff,
        // Deliberate duplicate/tampered prose proves the operational path does
        // not re-parse line classifiers or marker blocks.
        input: `${rawPrompt}\nPACKET_HASH: ${"0".repeat(64)}\nPREVIOUS FAILURE: invented prose`,
      });
      assert.equal(summary.schema, "setfarm.claim-summary.v2");
      const canonical = V3ImplementationContextV1Schema.parse(summary.canonicalImplementationContext);
      assert.deepEqual(canonical.handoff.implementationSlice, handoff.implementationSlice);
      assert.deepEqual(canonical.handoff.evidencePlan, handoff.evidencePlan);
      assert.deepEqual(canonical.handoff.executionProfile, {
        schema: "setfarm.model-execution-profile.v1",
        providerId: "minimax",
        modelId: "minimax/MiniMax-M3",
        selection: "primary",
      });
      assert.deepEqual(canonical.writeAuthority, { mode: "initial", allowedPaths: ["src/App.tsx"] });
      if (!("jsonSchema" in canonical.outputContract)) {
        throw new Error("expected versioned v2 implementation output contract");
      }
      assert.equal(canonical.outputContract.schema, "setfarm.v3-implementation-output-contract.v2");
      assert.equal(canonical.outputContract.source, "setfarm.v3-implementation-agent-proposal.v1");
      assert.equal(
        canonical.outputContract.jsonSchemaHash,
        hashCanonicalJson(canonical.outputContract.jsonSchema),
      );
      assert.doesNotMatch(JSON.stringify(canonical.outputContract.jsonSchema), /commandId|commands/);
      assert.match(canonical.outputContract.instruction, /Never emit STATUS.*STACK_PACK_ID/);
      assert.ok(
        Buffer.byteLength(serializeV3ImplementationContextV1(canonical), "utf8")
          <= V3_IMPLEMENTATION_CONTEXT_MAX_BYTES,
      );
      assert.equal(Object.hasOwn(summary, "retryFeedback"), false);
      assert.equal(Object.hasOwn(summary, "designContracts"), false);

      fs.writeFileSync(claimSummaryFile, `${JSON.stringify(summary, null, 2)}\n`);
      fs.writeFileSync(bootstrapFile, buildResolvedClaimBootstrapScript({
        claimFile,
        outputFile,
        claimSummaryFile,
        stepId: STEP_ID,
        workdir,
        taskPreview: "ignored v3 prose",
      }), { mode: 0o700 });
      const output = execFileSync("bash", [bootstrapFile], { encoding: "utf8", timeout: 10_000 });
      const contextPath = path.join(workdir, ".setfarm", "implement-context.json");
      assert.deepEqual(JSON.parse(fs.readFileSync(contextPath, "utf8")), canonical);
      assert.match(output, /IMPLEMENTATION_CONTEXT_SCHEMA=setfarm\.implementation-context\.v3/);
      assert.match(output, /CANONICAL_EVIDENCE_PLAN=handoff\.evidencePlan/);
      assert.doesNotMatch(output, /IMPLEMENT_EVIDENCE_SEEDED/);
      assert.equal(fs.existsSync(path.join(workdir, ".setfarm-bin", "setfarm-evidence")), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("continues to parse the exact historic implicit v1 context contract", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-handoff-v1-reader-"));
    try {
      const workdir = path.join(root, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      const { handoff } = fixture(workdir);
      const current = createV3ImplementationContextV1({ handoff });
      const historic = V3ImplementationContextV1Schema.parse({
        ...current,
        outputContract: {
          source: "setfarm.v3-implementation-agent-output.v1",
          format: "Return the strict v1 output object.",
          requiredFields: ["schema", "disposition", "handoffHash"],
          instruction: "Historic implicit v1 contract fixture.",
        },
      });
      assert.equal("jsonSchema" in historic.outputContract, false);
      assert.equal(historic.handoffHash, current.handoffHash);
      assert.deepEqual(historic.handoff, current.handoff);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("hands one exact operational fallback to Kimi as infrastructure retry authority", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-operational-retry-handoff-"));
    try {
      const workdir = path.join(root, "worktree");
      fs.mkdirSync(path.join(workdir, "src"), { recursive: true });
      fs.writeFileSync(path.join(workdir, "src", "App.tsx"), "export const App = () => null;\n");
      const { handoff } = fixture(workdir);
      const operationalRetry = createOperationalRetryDirectiveV1({
        runId: handoff.runId,
        stepId: "implement",
        storyId: handoff.storyId,
        priorAttempt: {
          claimId: handoff.claimId,
          attemptId: handoff.attemptId,
          generation: handoff.attemptGeneration,
          attemptClass: "product_implementation",
          packetHash: handoff.packetHash,
          sliceHash: handoff.sliceHash,
          sourceBefore: handoff.sourceBefore,
          terminalDisposition: "inconclusive",
        },
        failure: {
          code: "IMPLEMENT_NO_DELTA_STALL",
          diagnostic: "IMPLEMENT_NO_DELTA_STALL: no bounded source delta",
        },
        nextSourceRevision: handoff.sourceBefore,
        allowedPaths: ["src/App.tsx"],
      });
      const retryHandoff = createV3ImplementationClaimHandoffV1({
        ...handoff,
        claimId: 902,
        attemptId: "ATT_00000000-0000-0000-0000-000000000902",
        attemptGeneration: 2,
        executionAuthority: { role: "developer", attemptClass: "infrastructure_retry" },
        executionProfile: operationalRetry.executionProfile,
        operationalRetry,
        operationalRetryArtifactHash: hashCanonicalJson({
          schema: "setfarm.semantic-artifact-envelope.v1",
          artifactType: "setfarm.operational-retry-directive.v1",
          producer: handoff.artifactProducer,
          payload: operationalRetry,
        }),
      });
      const context = createV3ImplementationContextV1({ handoff: retryHandoff });
      assert.equal(context.writeAuthority.mode, "operational_retry");
      assert.deepEqual(context.writeAuthority.allowedPaths, ["src/App.tsx"]);
      assert.equal(context.handoff.executionProfile.modelId, "kimi/kimi-for-coding");
      assert.equal(context.handoff.workflowStepId, "implement");
      assert.equal(context.handoff.operationalRetry?.directiveHash, operationalRetry.directiveHash);
      assert.match(context.rules.join("\n"), /typed operational retry.*operationalRetry\.expectedDelta/i);

      assert.equal(V3ImplementationClaimHandoffV1Schema.safeParse({
        ...retryHandoff,
        executionProfile: handoff.executionProfile,
      }).success, false);
      assert.equal(V3ImplementationClaimHandoffV1Schema.safeParse({
        ...retryHandoff,
        operationalRetry: {
          ...operationalRetry,
          nextSourceRevision: { ...operationalRetry.nextSourceRevision, treeHash: "0".repeat(64) },
        },
      }).success, false);
      assert.equal(V3ImplementationClaimHandoffV1Schema.safeParse({
        ...retryHandoff,
        operationalRetry: undefined,
      }).success, false);
      const wrongStepRetry = createOperationalRetryDirectiveV1({
        runId: handoff.runId,
        stepId: "verify",
        storyId: handoff.storyId,
        priorAttempt: operationalRetry.priorAttempt,
        failure: operationalRetry.failure,
        nextSourceRevision: handoff.sourceBefore,
        allowedPaths: ["src/App.tsx"],
      });
      assert.equal(V3ImplementationClaimHandoffV1Schema.safeParse({
        ...retryHandoff,
        operationalRetry: wrongStepRetry,
        operationalRetryArtifactHash: hashCanonicalJson({
          schema: "setfarm.semantic-artifact-envelope.v1",
          artifactType: "setfarm.operational-retry-directive.v1",
          producer: handoff.artifactProducer,
          payload: wrongStepRetry,
        }),
      }).success, false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("measures the exact delivered context bytes and rejects oversized authority", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-handoff-capacity-"));
    try {
      const workdir = path.join(root, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      const { handoff } = fixture(workdir);
      const context = createV3ImplementationContextV1({ handoff });
      assert.equal(
        assertV3ImplementationContextCapacity(context),
        Buffer.byteLength(`${JSON.stringify(context, null, 2)}\n`, "utf8"),
      );

      const oversized = V3ImplementationContextV1Schema.parse({
        ...context,
        rules: Array.from({ length: 100 }, (_, index) =>
          `${String(index).padStart(3, "0")}:${"\0".repeat(1_996)}`),
        outputContract: {
          schema: "setfarm.v3-implementation-output-contract.v2",
          source: "capacity-test",
          format: "f".repeat(20_000),
          jsonSchema: { type: "object" },
          jsonSchemaHash: hashCanonicalJson({ type: "object" }),
          requiredFields: Array.from({ length: 100 }, (_, index) =>
            `${String(index).padStart(3, "0")}:${"r".repeat(196)}`),
          instruction: "i".repeat(4_000),
        },
      });
      assert.throws(
        () => assertV3ImplementationContextCapacity(oversized),
        (error: unknown) => error instanceof V3ImplementationContextCapacityError
          && error.code === "V3_IMPLEMENTATION_CONTEXT_CAPACITY_EXCEEDED"
          && error.bytes > V3_IMPLEMENTATION_CONTEXT_MAX_BYTES,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects missing, tampered, or differently-owned compiler handoffs before spawn", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-handoff-reject-"));
    try {
      const workdir = path.join(root, "worktree");
      fs.mkdirSync(workdir, { recursive: true });
      const { handoff, claimEnvelope, rawPrompt } = fixture(workdir);
      const base = {
        wfId: "feature-dev",
        role: "developer",
        claimFile: path.join(root, "claim.json"),
        outputFile: path.join(root, "output.txt"),
        bootstrapFile: path.join(root, "bootstrap.sh"),
        stepId: STEP_ID,
        runId: RUN_ID,
        workdir,
        repo: workdir,
        storyId: "US-001",
        claimEnvelope,
        input: rawPrompt,
      } as const;
      assert.throws(() => buildClaimSummary(base), /V3_IMPLEMENTATION_HANDOFF_MISSING/);
      assert.throws(() => buildClaimSummary({
        ...base,
        v3ImplementationHandoff: { ...handoff, packetHash: "0".repeat(64) },
      }), /Handoff packet hash differs from the exact slice/);
      assert.throws(() => buildClaimSummary({
        ...base,
        v3ImplementationHandoff: {
          ...handoff,
          implementationSlice: {
            ...handoff.implementationSlice,
            story: { ...handoff.implementationSlice.story, description: "tampered after CAS publication" },
          },
        },
      }), /Slice hash must bind the exact semantic artifact envelope/);
      assert.throws(() => buildClaimSummary({
        ...base,
        v3ImplementationHandoff: { ...handoff, sliceRef: "SLICE_US_001_0000000000000000" },
      }), /Slice ref must bind the exact story and artifact hash/);
      assert.throws(() => buildClaimSummary({
        ...base,
        v3ImplementationHandoff: {
          ...handoff,
          artifactProducer: { ...handoff.artifactProducer, model: "tampered-model" },
        },
      }), /semantic artifact envelope handed to the agent/);
      assert.throws(() => buildClaimSummary({
        ...base,
        v3ImplementationHandoff: { ...handoff, evidencePlanRef: "EVIDENCE_PLAN_US_001_0000000000000000" },
      }), /Evidence plan ref must bind the exact story and artifact hash/);
      assert.throws(() => buildClaimSummary({
        ...base,
        claimEnvelope: {
          ...claimEnvelope,
          attempt: { ...claimEnvelope.attempt!, generation: 2 },
        },
        v3ImplementationHandoff: handoff,
      }), /V3_IMPLEMENTATION_HANDOFF_CLAIM_IDENTITY_MISMATCH/);
      assert.throws(() => buildClaimSummary({
        ...base,
        claimEnvelope: {
          ...claimEnvelope,
          claimAgentId: "feature-dev_supervisor",
        },
        v3ImplementationHandoff: handoff,
      }), /V3_IMPLEMENTATION_HANDOFF_CLAIM_ROLE_MISMATCH/);
      assert.throws(() => buildClaimSummary({
        ...base,
        role: "supervisor",
        claimEnvelope: {
          ...claimEnvelope,
          claimAgentId: "feature-dev_supervisor",
        },
        v3ImplementationHandoff: handoff,
      }), /V3_IMPLEMENTATION_HANDOFF_ROLE_MISMATCH/);
      assert.throws(() => buildClaimSummary({
        ...base,
        role: "supervisor",
        claimEnvelope: {
          ...claimEnvelope,
          claimAgentId: "feature-dev_supervisor",
        },
      }), /V3_IMPLEMENTATION_HANDOFF_MISSING/);
      assert.equal(V3ImplementationClaimHandoffV1Schema.safeParse({
        ...handoff,
        executionAuthority: {
          role: "supervisor",
          attemptClass: "supervisor_repair",
        },
      }).success, false);
      assert.equal(V3ImplementationClaimHandoffV1Schema.safeParse(handoff).success, true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses a concise v3 preclaimed prompt without legacy retry classifiers", () => {
    const prompt = buildPreclaimedPrompt({
      wfId: "feature-dev",
      role: "developer",
      protocol: "v3",
      claimFile: "/tmp/v3-claim.json",
      claimSummaryFile: "/tmp/v3-summary.json",
      outputFile: "/tmp/v3-output.txt",
      bootstrapFile: "/tmp/v3-bootstrap.sh",
    });
    assert.match(prompt, /setfarm\.implementation-context\.v3/);
    assert.match(prompt, /sole product, design, topology, ownership, command, state, persistence, recovery, and acceptance authority/);
    assert.doesNotMatch(prompt, /retryFeedback|DESIGN_MISMATCH|PR_REVIEW_COMMENTS_OPEN|setfarm-summary/);
    assert.match(prompt, /exactly one JSON object matching outputContract\.jsonSchema/);
    assert.match(prompt, /do not add[\s\S]*command outcomes, command notes, or evidence verdicts/);
    assert.match(prompt, /compile the proposal before any runtime drain/);
    assert.match(prompt, /Never call step fail for any native v3 implementation outcome/);
    assert.match(prompt, /runtime and process failures are owned by the spawner/);
    assert.doesNotMatch(prompt, /step fail "\$STEP_ID"/);
    assert.match(prompt, /--claim-file '\/tmp\/v3-claim\.json'/);

    const supervisorPrompt = buildPreclaimedPrompt({
      wfId: "feature-dev",
      role: "supervisor",
      protocol: "v3",
      claimFile: "/tmp/v3-supervisor-claim.json",
      claimSummaryFile: "/tmp/v3-supervisor-summary.json",
      outputFile: "/tmp/v3-supervisor-output.txt",
      bootstrapFile: "/tmp/v3-supervisor-bootstrap.sh",
    });
    assert.match(supervisorPrompt, /Product Compiler v3 supervisor repair claim ready/);
    assert.match(supervisorPrompt, /setfarm\.implementation-context\.v3/);
    assert.match(supervisorPrompt, /exactly one JSON object/);
    assert.doesNotMatch(supervisorPrompt, /retryFeedback|DESIGN_MISMATCH|PR_REVIEW_COMMENTS_OPEN|setfarm-summary/);
    assert.doesNotMatch(supervisorPrompt, /step fail "\$STEP_ID"/);
  });
});
