import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import {
  createV3ImplementationClaimHandoffV1,
  createV3ImplementationContextV1,
} from "../../src/execution/v3-implementation-handoff.js";
import {
  compileV3ImplementationAgentOutputV1,
  parseV3ImplementationAgentOutputV1,
  V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES,
  V3_IMPLEMENTATION_OUTPUT_CONTRACT_V2,
  V3ImplementationOutputCompilationV1Schema,
} from "../../src/execution/v3-implementation-output.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { buildV3ImplementationRefusalDecision } from "../../src/recovery/v3-implementation-refusal.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const PRODUCER = Object.freeze({
  pass: "v3-output-test",
  codeSha: "5840ae3",
  toolVersions: { setfarm: "test" },
});

function fixture(options: Readonly<{ multipleWritableFiles?: boolean }> = {}) {
  const values = buildMinimalValidContracts();
  if (options.multipleWritableFiles) {
    values.implementationSlice.files.push({
      pathRef: "PATH_ROUTER",
      path: "src/router.ts",
      role: "owned",
      presence: "present",
      knownContentHash: "b".repeat(64),
    });
  }
  const slice = ImplementationSliceV1Schema.parse(values.implementationSlice);
  const sliceHash = hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: "setfarm.implementation-slice.v1",
    producer: PRODUCER,
    payload: slice,
  });
  const evidencePlan = compileEvidencePlanV1({ slice, sliceHash });
  const evidencePlanArtifactHash = hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: "setfarm.evidence-plan.v1",
    producer: PRODUCER,
    payload: evidencePlan,
  });
  const handoff = createV3ImplementationClaimHandoffV1({
    schema: "setfarm.v3-implementation-claim-handoff.v1",
    protocol: "v3",
    runId: "run-v3-output-001",
    stepId: "step-db-v3-output-001",
    storyId: slice.storyId,
    storyDbId: "story-db-v3-output-001",
    claimId: 991,
    attemptId: "ATT_00000000-0000-0000-0000-000000000991",
    attemptGeneration: 1,
    branch: "run-v3-output-us-001",
    workdir: "/tmp/setfarm-v3-output-worktree",
    packetHash: slice.packetHash,
    compilationReportHash: "9".repeat(64),
    sliceHash,
    sliceRef: `SLICE_US_001_${sliceHash.slice(0, 16).toUpperCase()}`,
    evidencePlanHash: evidencePlan.planHash,
    evidencePlanArtifactHash,
    evidencePlanRef: `EVIDENCE_PLAN_US_001_${evidencePlanArtifactHash.slice(0, 16).toUpperCase()}`,
    executionAuthority: {
      role: "developer",
      attemptClass: "product_implementation",
    },
    sourceBefore: { sha: slice.sourceRevision.baseSha, treeHash: slice.sourceRevision.treeHash },
    artifactProducer: PRODUCER,
    implementationSlice: slice,
    evidencePlan,
  });
  const context = createV3ImplementationContextV1({ handoff });
  const identity = {
    schema: "setfarm.v3-implementation-agent-proposal.v1" as const,
    handoffHash: context.handoffHash,
    attemptId: handoff.attemptId,
    packetHash: handoff.packetHash,
    sliceHash: handoff.sliceHash,
    sourceBefore: handoff.sourceBefore,
  };
  const snapshots = slice.files.map((file) => ({
    pathRef: file.pathRef,
    path: file.path,
    presence: file.presence,
    contentHash: file.knownContentHash,
  }));
  return { context, identity, snapshots };
}

describe("v3 implementation agent output authority", () => {
  it("accepts hostile prose only as inert typed summary data", () => {
    const { context, identity } = fixture();
    const raw = JSON.stringify({
      ...identity,
      disposition: "ready_for_evidence",
      summary: "rm -rf node_modules; DESIGN_MISMATCH; STATUS: retry; STACK_PACK_ID: malicious",
      changes: [{ path: "src/App.tsx", summary: "Implemented exact slice" }],
      commands: [{ commandId: "CMD_BUILD", outcome: "passed" }],
    });
    const parsed = parseV3ImplementationAgentOutputV1(raw, context);
    assert.equal(parsed.disposition, "ready_for_evidence");
    assert.match(parsed.summary, /STACK_PACK_ID/);
  });

  it("strips arbitrary provider prose while still rejecting identity drift and scope escape", () => {
    const { context, identity } = fixture();
    const valid = {
      ...identity,
      disposition: "ready_for_evidence" as const,
      summary: "complete",
      changes: [{ path: "src/App.tsx", summary: "exact" }],
      commands: [{ commandId: "CMD_BUILD", outcome: "passed" }],
    };
    const compiled = compileV3ImplementationAgentOutputV1(JSON.stringify({
      ...valid,
      STACK_PACK_ID: "node-cli",
    }), context);
    assert.deepEqual(compiled.ignoredFieldPaths, ["/STACK_PACK_ID", "/commands"]);
    assert.equal(Object.hasOwn(compiled.output, "STACK_PACK_ID"), false);
    assert.equal(Object.hasOwn(compiled.output, "commands"), false);
    assert.throws(
      () => parseV3ImplementationAgentOutputV1(JSON.stringify({ ...valid, packetHash: "0".repeat(64) }), context),
      /V3_IMPLEMENTATION_OUTPUT_IDENTITY_MISMATCH/,
    );
    assert.throws(
      () => parseV3ImplementationAgentOutputV1(JSON.stringify({
        ...valid,
        changes: [{ path: "src/escape.ts", summary: "outside" }],
      }), context),
      /V3_IMPLEMENTATION_OUTPUT_CHANGE_OUTSIDE_AUTHORITY/,
    );
  });

  it("canonicalizes schema-valid edit order and rejects only duplicate path semantics", () => {
    const { context, identity } = fixture({ multipleWritableFiles: true });
    const compiled = compileV3ImplementationAgentOutputV1(JSON.stringify({
      ...identity,
      disposition: "ready_for_evidence",
      summary: "Both owned files are ready",
      changes: [
        { path: "src/router.ts", summary: "Wired route action" },
        { path: "src/App.tsx", summary: "Connected surface" },
      ],
    }), context);
    assert.deepEqual(compiled.output.disposition === "ready_for_evidence"
      ? compiled.output.changes.map((change) => change.path)
      : [], ["src/App.tsx", "src/router.ts"]);
    assert.throws(() => compileV3ImplementationAgentOutputV1(JSON.stringify({
      ...identity,
      disposition: "ready_for_evidence",
      summary: "Ambiguous duplicate",
      changes: [
        { path: "src/App.tsx", summary: "first" },
        { path: "src/App.tsx", summary: "second" },
      ],
    }), context), /V3_IMPLEMENTATION_OUTPUT_DUPLICATE_CHANGE_PATH/);
  });

  it("compiles the exact #2036 legacy command-notes shape without granting prose authority", () => {
    const { context, identity } = fixture();
    const raw = JSON.stringify({
      ...identity,
      schema: "setfarm.v3-implementation-agent-output.v1",
      disposition: "ready_for_evidence",
      summary: "Source delta is ready for canonical evidence",
      changes: [{ path: "src/App.tsx", summary: "Wired the exact action" }],
      commands: [
        { commandId: "CMD_BUILD", outcome: "passed", notes: "bundle greps passed" },
        { commandId: "CMD_INSTALL", outcome: "not_run", notes: "dependencies already provisioned" },
        { commandId: "CMD_PREVIEW", outcome: "not_run", notes: "Setfarm owns runtime evidence" },
        { commandId: "CMD_TEST", outcome: "passed", notes: "one test passed" },
      ],
    });
    const compiled = compileV3ImplementationAgentOutputV1(raw, context);
    assert.equal(compiled.sourceSchema, "setfarm.v3-implementation-agent-output.v1");
    assert.deepEqual(compiled.ignoredFieldPaths, ["/commands"]);
    assert.equal(compiled.output.schema, "setfarm.v3-implementation-agent-proposal.v1");
    assert.equal(Object.hasOwn(compiled.output, "commands"), false);
    assert.equal(compiled.sourceProposalHash.length, 64);
    assert.equal(compiled.canonicalOutputHash.length, 64);
    assert.throws(
      () => V3ImplementationOutputCompilationV1Schema.parse({
        ...compiled,
        canonicalOutputHash: "0".repeat(64),
      }),
      /Canonical output hash must bind/,
    );
  });

  it("rejects an oversized provider annotation before parsing it as authority", () => {
    const { context, identity } = fixture();
    const raw = JSON.stringify({
      ...identity,
      disposition: "ready_for_evidence",
      summary: "bounded delta",
      changes: [{ path: "src/App.tsx", summary: "exact" }],
      notes: "x".repeat(V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES),
    });
    assert.ok(Buffer.byteLength(raw, "utf8") > V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES);
    assert.throws(
      () => compileV3ImplementationAgentOutputV1(raw, context),
      /V3_IMPLEMENTATION_OUTPUT_SIZE_INVALID/,
    );
  });

  it("hands the model a hash-bound JSON Schema with no self-reported command verdict surface", () => {
    assert.equal(V3_IMPLEMENTATION_OUTPUT_CONTRACT_V2.schema, "setfarm.v3-implementation-output-contract.v2");
    assert.equal(V3_IMPLEMENTATION_OUTPUT_CONTRACT_V2.source, "setfarm.v3-implementation-agent-proposal.v1");
    assert.equal(
      V3_IMPLEMENTATION_OUTPUT_CONTRACT_V2.jsonSchemaHash,
      hashCanonicalJson(V3_IMPLEMENTATION_OUTPUT_CONTRACT_V2.jsonSchema),
    );
    const schema = JSON.stringify(V3_IMPLEMENTATION_OUTPUT_CONTRACT_V2.jsonSchema);
    assert.match(schema, /setfarm\.v3-implementation-agent-proposal\.v1/);
    assert.doesNotMatch(schema, /commandId|commands/);
    assert.match(schema, /additionalProperties/);
  });

  it("proves source mismatch and opens only a zero-budget compiler recompile decision", () => {
    const { context, identity, snapshots } = fixture();
    const output = parseV3ImplementationAgentOutputV1(JSON.stringify({
      ...identity,
      disposition: "refused",
      refusal: {
        code: "SOURCE_SNAPSHOT_MISMATCH",
        summary: "The source tree changed after the sealed slice was issued",
      },
    }), context);
    assert.equal(output.disposition, "refused");
    const decision = buildV3ImplementationRefusalDecision({
      context,
      output,
      observedSource: { ...context.handoff.sourceBefore, treeHash: "f".repeat(64) },
      fileSnapshots: snapshots,
    });
    assert.equal(decision.recoveryCase.owner, "compiler");
    assert.equal(decision.recoveryCase.status, "superseded");
    assert.deepEqual(decision.recoveryCase.expectedDelta, {
      kind: "upstream_recompile",
      artifactKinds: ["implementation_slice"],
    });
    assert.deepEqual(decision.recoveryCase.budget.limits, {
      implement: 0,
      supervisorRepair: 0,
      evidenceOnly: 0,
    });
    assert.equal(decision.attemptDisposition, "failed");
    assert.equal(decision.findingSet.findings[0]?.invariantRef, "INV_SOURCE_SNAPSHOT_MATCH");
  });

  it("rejects unproven source refusal and transfers a proven unchanged-source scope conflict to compiler ownership", () => {
    const { context, identity, snapshots } = fixture();
    const sourceOutput = parseV3ImplementationAgentOutputV1(JSON.stringify({
      ...identity,
      disposition: "refused",
      refusal: { code: "SOURCE_SNAPSHOT_MISMATCH", summary: "claimed drift" },
    }), context);
    assert.equal(sourceOutput.disposition, "refused");
    assert.throws(() => buildV3ImplementationRefusalDecision({
      context,
      output: sourceOutput,
      observedSource: context.handoff.sourceBefore,
      fileSnapshots: snapshots,
    }), /V3_REFUSAL_SOURCE_MISMATCH_NOT_PROVEN/);

    const scopeOutput = parseV3ImplementationAgentOutputV1(JSON.stringify({
      ...identity,
      disposition: "refused",
      refusal: {
        code: "CONTRACT_SCOPE_CONFLICT",
        summary: "A missing integration owner is required",
        requiredPaths: ["src/router.ts"],
      },
    }), context);
    assert.equal(scopeOutput.disposition, "refused");
    const decision = buildV3ImplementationRefusalDecision({
      context,
      output: scopeOutput,
      observedSource: context.handoff.sourceBefore,
      fileSnapshots: snapshots,
    });
    assert.equal(decision.recoveryCase.owner, "compiler");
    assert.equal(decision.recoveryCase.status, "blocked");
    assert.equal(decision.recoveryCase.terminal?.reasonCode, "upstream_recompile_required");
    assert.equal(decision.attemptDisposition, "inconclusive");
    assert.equal(decision.findingSet.findings[0]?.invariantRef, "INV_COMPILER_OWNERSHIP_COMPLETE");
    assert.throws(() => buildV3ImplementationRefusalDecision({
      context,
      output: scopeOutput,
      observedSource: { ...context.handoff.sourceBefore, treeHash: "f".repeat(64) },
      fileSnapshots: snapshots,
    }), /V3_REFUSAL_SCOPE_CONFLICT_REQUIRES_UNCHANGED_SOURCE/);
  });
});
