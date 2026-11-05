import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { hashRuntimeEvidenceContractV1, RuntimeEvidenceContractV1Schema } from "../../src/evidence/runtime-evidence-contract-v1.js";
import { createV3ArtifactRefKeyV2 } from "../../src/execution/v3-artifact-ref-key-v2.js";
import { createV3PreparationClaimAuthorityV2 } from "../../src/execution/v3-preparation-claim-authority-v2.js";
import { ClaimEnvelopeV1Schema } from "../../src/execution/schemas/claim-envelope-v1.js";
import { resolveV3ExecutionProfile } from "../../src/execution/operational-retry-directive.js";
import { runImplementEvidenceIfRequested } from "../../src/installer/implement-evidence-runner.js";
import { SemanticArtifactEnvelopeV1Schema } from "../../src/product-compiler/artifact-store.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceImplementationSourceMapV1 } from "../../src/product-compiler/producers/implementation-source-map-v1.js";
import { produceStoryPlanV2 } from "../../src/product-compiler/producers/story-plan-v2.js";
import { ProductBuildPacketV3Schema } from "../../src/product-compiler/schemas/product-build-packet-v3.js";
import { ProductCompilationReportV3Schema } from "../../src/product-compiler/schemas/compilation-report-v3.js";
import { compileLegacyImplementationSliceV2 } from "../../src/product-compiler/slice-compiler-v2-legacy.js";
import { buildClaimSummary } from "../../src/spawner-prompt.js";
import { NATIVE_JOIN_PRODUCER, NATIVE_JOIN_SOURCE, nativeJoinPacket } from "./helpers/native-implementation-join-fixture.js";

const RUN_ID = "run-native-context-evidence-001";
const STEP_ID = "step-db-native-context-evidence-001";
const STORY_DB_ID = "story-db-native-context-evidence-001";
const CLAIM_ID = 1071;
const ATTEMPT_ID = "ATT_00000000-0000-0000-0000-000000001071";
const SOURCE_BEFORE = { sha: "1".repeat(40), treeHash: "2".repeat(40) };
const CANDIDATE_SOURCE = { sha: "3".repeat(40), treeHash: "4".repeat(40) };

function envelope(artifactType: string, payload: unknown) {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1", artifactType, producer: NATIVE_JOIN_PRODUCER, payload,
  });
}

function compiledNativeCliFixture() {
  const sealed = nativeJoinPacket(RUN_ID);
  // Reproduce the real projections after adding an initial state observation.
  // The CLI result (/task) and captured product state (/state) are deliberately
  // separate coordinates, just as they are in the genuine invocation contract.
  const runtime = RuntimeEvidenceContractV1Schema.parse({
    ...sealed.buildTopology.runtimeEvidenceContract,
    adapter: "cli-process", stackPackId: "node-cli",
    initial: {
      command: { argv: ["node", "dist/index.js", "inspect"], cwd: ".", timeoutMs: 30_000 },
      expectedExitCode: 0, capture: { format: "json", statePointer: "/state" },
    },
    actions: [{ actionRef: "ACT_ADD_TASK", inputValues: { title: "Ship Setfarm" }, action: {
      command: { argv: ["node", "dist/index.js", "add", "--title", "Ship Setfarm"], cwd: ".", timeoutMs: 30_000 },
      expectedExitCode: 0, capture: { format: "json", statePointer: "/state" },
    } }],
  });
  const buildTopology = {
    ...sealed.buildTopology,
    runtimeEvidenceContract: runtime,
    runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtime),
  };
  const stories = produceStoryPlanV2({ productSpec: sealed.productSpec, buildTopology });
  assert.equal(stories.status, "produced", JSON.stringify(stories));
  if (stories.status !== "produced") throw Error("native story fixture rejected");
  const sourceMap = produceImplementationSourceMapV1({
    designSourceKind: "none", productSpec: sealed.productSpec, designGraph: null,
    buildTopology, storyPlan: stories.storyPlan, designSourceClosure: sealed.designSourceClosure,
    generationTargets: null, responseBindings: null, screenIndex: [], screenIndexSource: null,
    converterSource: null, generatedSources: [],
  });
  assert.equal(sourceMap.status, "produced", JSON.stringify(sourceMap));
  if (sourceMap.status !== "produced") throw Error("native source-map fixture rejected");
  const packet = ProductBuildPacketV3Schema.parse({
    ...sealed.packet,
    buildTopologyV1Hash: hashCanonicalJson(envelope("setfarm.build-topology.v1", buildTopology)),
    storyPlanV2Hash: hashCanonicalJson(envelope("setfarm.story-plan.v2", stories.storyPlan)),
    implementationSourceMapV1Hash: hashCanonicalJson(envelope("setfarm.implementation-source-map.v1", sourceMap.sourceMap)),
    runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtime),
  });
  const packetEnvelope = envelope("setfarm.product-build-packet.v3", packet);
  const packetHash = hashCanonicalJson(packetEnvelope);
  const report = ProductCompilationReportV3Schema.parse({
    ...sealed.compilationReport, packetHash,
    artifactHashes: {
      ...sealed.compilationReport.artifactHashes,
      buildTopologyV1: packet.buildTopologyV1Hash,
      storyPlanV2: packet.storyPlanV2Hash,
      implementationSourceMapV1: packet.implementationSourceMapV1Hash,
    },
  });
  const compilationReportEnvelope = envelope("setfarm.product-compilation-report.v3", report);
  const compilationReportHash = hashCanonicalJson(compilationReportEnvelope);
  const compiled = compileLegacyImplementationSliceV2({
    packetHash, packet, productSpec: sealed.productSpec, designGraph: null, buildTopology,
    storyPlan: stories.storyPlan, designSourceClosure: sealed.designSourceClosure,
    implementationSourceMap: sourceMap.sourceMap, storyId: "US-001",
    sourceRevision: SOURCE_BEFORE, producer: NATIVE_JOIN_PRODUCER,
    currentFiles: buildTopology.pathBindings.map(file => ({
      pathRef: file.id, presence: file.presence, contentHash: file.knownContentHash,
    })),
    dependencyOutputs: [],
  });
  assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
  if (compiled.status !== "compiled") throw Error("native slice fixture rejected");
  assert.equal(compiled.slice.schema, "setfarm.implementation-slice.v2");
  assert.equal(compiled.slice.packet.schema, "setfarm.product-build-packet.v3");
  assert.equal(compiled.slice.contract.design, null);
  assert.equal(compiled.slice.contract.product.actions[0]!.invocationInterface?.kind, "cli_command");
  assert.equal(compiled.slice.contract.product.evidencePredicates.filter(predicate => predicate.required).length, 2);
  const nativeAuthority = createV3PreparationClaimAuthorityV2({
    stateVersion: 1, runId: RUN_ID, stepId: "implement", storyId: "US-001",
    packetHash, compilationReportHash, baseRevision: SOURCE_BEFORE,
    projectedDependencyIds: [], dependencyAttempts: [],
  });
  return { ...compiled, nativeAuthority, packetEnvelope, compilationReportEnvelope, compilationReportHash };
}

/** A complete expected native plan, not a Task9 publication or dispatch artifact.
 * GREEN must make the real native compiler reproduce it from this native slice.
 * No historical slice/compiler or nonexistent new module is used to create RED.
 */
function expectedCliPlan(value: ReturnType<typeof compiledNativeCliFixture>) {
  const action = value.slice.contract.product.actions[0]!;
  const identity = {
    schema: "setfarm.evidence-plan.v2",
    packetHash: value.slice.packetHash, sliceHash: value.sliceHash, storyId: "US-001",
    runtime: value.slice.build.runtimeEvidenceContract,
    commands: [{ commandRef: "CMD_BUILD", kind: "build", argv: ["npm", "run", "build"], cwd: ".", timeoutMs: 120_000 }],
    flows: [{
      flowId: "flow:ACT_ADD_TASK", actionRef: "ACT_ADD_TASK",
      surfaceRefs: ["SURF_TERMINAL"],
      preconditions: [], scenario: { targetInputValues: { title: "Ship Setfarm" }, prerequisiteSteps: [] },
      inputBindings: [{ inputField: "title", valueFrom: { kind: "literal", value: "Ship Setfarm" } }],
      predicateRefs: [...action.evidenceRefs].sort(),
      observableEffects: action.observableEffects,
      observableBindings: [],
      interactions: [{
        id: "action:ACT_ADD_TASK", action: "invoke", target: "ACT_ADD_TASK", value: "action",
        inputValues: { title: "Ship Setfarm" }, timeoutMs: 30_000,
      }],
      actionInteractionId: "action:ACT_ADD_TASK",
    }],
    predicateRefs: [...action.evidenceRefs].sort(),
  };
  return { ...identity, planHash: hashCanonicalJson(identity) };
}

function nativeHandoff(value: ReturnType<typeof compiledNativeCliFixture>, workdir: string) {
  const evidencePlan = expectedCliPlan(value);
  const evidencePlanArtifactHash = hashCanonicalJson(envelope("setfarm.evidence-plan.v2", evidencePlan));
  return {
    schema: "setfarm.v3-implementation-claim-handoff.v2", protocol: "v3",
    runId: RUN_ID, stepId: STEP_ID, workflowStepId: "implement", storyId: "US-001", storyDbId: STORY_DB_ID,
    claimId: CLAIM_ID, attemptId: ATTEMPT_ID, attemptGeneration: 1,
    branch: "run-native-context-us-001", workdir, packetHash: value.slice.packetHash,
    compilationReportHash: value.compilationReportHash,
    sliceHash: value.sliceHash, sliceRef: createV3ArtifactRefKeyV2("slice", "US-001", value.sliceHash),
    evidencePlanHash: evidencePlan.planHash, evidencePlanArtifactHash,
    evidencePlanRef: createV3ArtifactRefKeyV2("evidence_plan", "US-001", evidencePlanArtifactHash),
    executionAuthority: { role: "developer", attemptClass: "product_implementation" },
    executionProfile: resolveV3ExecutionProfile("primary"), sourceBefore: SOURCE_BEFORE,
    artifactProducer: NATIVE_JOIN_PRODUCER,
    packetEnvelope: value.packetEnvelope, compilationReportEnvelope: value.compilationReportEnvelope,
    nativeAuthority: value.nativeAuthority,
    implementationSlice: value.slice, evidencePlan, reviewEvidenceArtifacts: [],
  };
}

describe("native PacketV3 context and owned evidence admission", () => {
  // Catches the legacy-only handoff branch discarding/rejecting genuine native
  // authority before the real claim-summary/context consumer can expose it.
  it("admits the exact native packet/report/slice/plan through the existing claim summary", () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-context-"));
    try {
      fs.mkdirSync(path.join(workdir, "src"));
      fs.writeFileSync(path.join(workdir, "src/index.ts"), NATIVE_JOIN_SOURCE);
      const value = compiledNativeCliFixture();
      const handoff = nativeHandoff(value, workdir);
      const claimEnvelope = ClaimEnvelopeV1Schema.parse({
        schema: "setfarm.claim-envelope.v1", protocol: "v3", issuedAt: "2026-11-05T00:00:00.000Z",
        runId: RUN_ID, stepId: STEP_ID, workflowStepId: "implement", storyId: "US-001", storyDbId: STORY_DB_ID,
        claimId: CLAIM_ID, claimGeneration: 1, claimAgentId: "feature-dev_developer", runtimeAgentId: "actual-native-developer",
        attempt: { attemptId: ATTEMPT_ID, generation: 1, fenceToken: "f".repeat(64) }, workdir, repo: workdir,
      });
      const summary = buildClaimSummary({
        wfId: "feature-dev", role: "developer", claimFile: path.join(workdir, "claim.json"),
        outputFile: path.join(workdir, "output.json"), bootstrapFile: path.join(workdir, "bootstrap.sh"),
        stepId: STEP_ID, runId: RUN_ID, workdir, repo: workdir, storyId: "US-001",
        claimEnvelope, v3ImplementationHandoff: handoff, input: "Untrusted legacy prose has no implementation authority.",
      });
      const context = summary.canonicalImplementationContext;
      assert.ok(context && typeof context === "object" && "schema" in context && "handoff" in context && "handoffHash" in context && "writeAuthority" in context);
      assert.equal(context.schema, "setfarm.implementation-context.v3");
      assert.deepEqual(context.handoff, handoff);
      assert.equal(context.handoffHash, hashCanonicalJson(handoff));
      assert.deepEqual(context.writeAuthority, { mode: "initial", allowedPaths: ["src/index.ts"] });
      assert.ok(Buffer.byteLength(JSON.stringify(context, null, 2) + "\n") > 12 * 1024,
        "the actual full native witnesses exceed one readable part and must remain lossless");
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });

  // Catches legacy-only plan compilation or generic-snapshot fallback in the
  // real owned runner. The declared build and CLI run as actual subprocesses.
  it("executes native no-design invocation predicates with the existing owned evidence runner", async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-owned-evidence-"));
    try {
      const value = compiledNativeCliFixture();
      fs.mkdirSync(path.join(workdir, "src"));
      fs.writeFileSync(path.join(workdir, "src/index.ts"), [
        "const fs = require('node:fs');",
        "const argv = process.argv.slice(2);",
        "if (argv[0] === 'inspect') { process.stdout.write(JSON.stringify({state:[]})); process.exit(0); }",
        "if (argv[0] !== 'add' || argv[1] !== '--title' || !argv[2]) process.exit(2);",
        "const title = argv[2];",
        "fs.writeFileSync('invoked-title.json', JSON.stringify({title}));",
        "process.stdout.write(JSON.stringify({task:{title},state:[title]}));",
      ].join("\n"));
      fs.writeFileSync(path.join(workdir, "package.json"), JSON.stringify({ scripts: {
        build: "node -e \"const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});fs.copyFileSync('src/index.ts','dist/index.js')\"",
      } }));
      const result = await runImplementEvidenceIfRequested({
        runId: RUN_ID, storyId: "US-001", workdir, stackPackId: "node-cli",
        v3: { slice: value.slice, sliceHash: value.sliceHash, attemptId: ATTEMPT_ID, sourceRevision: CANDIDATE_SOURCE },
      });
      assert.equal(result.attempted, true);
      assert.equal(result.ok, true, result.reason);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(workdir, "invoked-title.json"), "utf8")), { title: "Ship Setfarm" });
      assert.deepEqual(result.evidencePlan, expectedCliPlan(value), "real native compiler must reproduce the independent complete native-plan oracle");
      const bundle = result.canonicalEvidence?.bundle;
      assert.ok(bundle, "native evidence must have a canonical owned bundle");
      assert.equal(bundle.aggregateVerdict, "pass");
      assert.equal(bundle.attemptId, ATTEMPT_ID);
      assert.equal(bundle.packetHash, value.slice.packetHash);
      assert.equal(bundle.sliceHash, value.sliceHash);
      assert.deepEqual(bundle.sourceRevision, CANDIDATE_SOURCE);
      assert.notDeepEqual(bundle.sourceRevision, value.slice.sourceRevision);
      const productPredicates = bundle.predicates.filter(predicate => predicate.invariantRef !== "INV_COMMAND_BUILD");
      assert.deepEqual(productPredicates.map(predicate => predicate.predicateRef).sort(), expectedCliPlan(value).predicateRefs);
      assert.ok(productPredicates.every(predicate => predicate.required && predicate.verdict === "pass"));
      assert.ok(productPredicates.some(predicate => predicate.invariantRef === "INV_ACTION_INVOCATION"));
      assert.ok(productPredicates.some(predicate => predicate.invariantRef === "INV_OBSERVABLE_OUTCOME"));
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });
});
