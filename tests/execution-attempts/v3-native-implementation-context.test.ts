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
import { compileLegacyImplementationSliceV2, verifyLegacyImplementationSliceV2 } from "../../src/product-compiler/slice-compiler-v2-legacy.js";
import { createGithubReviewSource, GithubReviewThreadEvidenceV1Schema } from "../../src/findings/github-review-source.js";
import { ingestGithubReviewThreadsV1, type GithubActionableReviewCommentV1 } from "../../src/findings/github-review-ingestion.js";
import { buildClaimSummary } from "../../src/spawner-prompt.js";
import { parseSubscriptionWorkflowReportV1, planSubscriptionWorkflowHandoffV1 } from "../../src/execution/subscription-workflow-transport-v1.js";
import { createV3ImplementationContext, parseV3ImplementationContext, serializeV3ImplementationContext } from "../../src/execution/v3-implementation-handoff.js";
import { V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES, compileV3ImplementationAgentOutputV1 } from "../../src/execution/v3-implementation-output.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { buildV3ImplementationRefusalDecision, captureV3RefusalFileSnapshots } from "../../src/recovery/v3-implementation-refusal.js";
import { createFindingSetFromEvidenceBundleV2 } from "../../src/findings/evidence-finding-set.js";
import { createCanonicalEvidenceBundleV2 } from "../../src/evidence/canonical-evidence-runner.js";
import { BuildTopologyV1Schema } from "../../src/product-compiler/schemas/build-topology-v1.js";
import { createHash } from "node:crypto";
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

function compiledNativeCliFixture(shared = false) {
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
  const buildTopology = BuildTopologyV1Schema.parse({
    ...sealed.buildTopology,
    runtimeEvidenceContract: runtime,
    runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtime),
    owners: [...sealed.buildTopology.owners, ...(shared ? [{ id: "OWNER_SETUP", kind: "setup" }] : [])],
    pathBindings: [...sealed.buildTopology.pathBindings, ...(shared ? [
      { id: "PATH_SHARED_READ", path: "src/shared/read.ts", role: "source", ownerRef: "OWNER_SETUP", presence: "present", knownContentHash: createHash("sha256").update(NATIVE_JOIN_SOURCE).digest("hex") },
      { id: "PATH_SHARED_WRITE", path: "src/shared/write.ts", role: "source", ownerRef: "OWNER_SETUP", presence: "present", knownContentHash: createHash("sha256").update(NATIVE_JOIN_SOURCE).digest("hex") },
    ] : [])],
    sharedGrants: shared ? [
      { id: "GRANT_SETUP_READ", fromOwnerRef: "OWNER_SETUP", toOwnerRef: "OWNER_US_001", pathRefs: ["PATH_SHARED_READ"], permissions: ["read"] },
      { id: "GRANT_SETUP_WRITE", fromOwnerRef: "OWNER_SETUP", toOwnerRef: "OWNER_US_001", pathRefs: ["PATH_SHARED_WRITE"], permissions: ["read", "write"] },
    ] : [],
  });
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
  const compilerInput = {
    packetHash, packet, productSpec: sealed.productSpec, designGraph: null, buildTopology,
    storyPlan: stories.storyPlan, designSourceClosure: sealed.designSourceClosure,
    implementationSourceMap: sourceMap.sourceMap, storyId: "US-001",
    sourceRevision: SOURCE_BEFORE, producer: NATIVE_JOIN_PRODUCER,
    currentFiles: buildTopology.pathBindings.map(file => ({
      pathRef: file.id, presence: file.presence, contentHash: file.knownContentHash,
    })),
    dependencyOutputs: [],
  };
  const compiled = compileLegacyImplementationSliceV2(compilerInput);
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
  return { ...compiled, compilerInput, nativeAuthority, packetEnvelope, compilationReportEnvelope, compilationReportHash };
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

function claimFor(workdir: string) {
  return ClaimEnvelopeV1Schema.parse({
    schema: "setfarm.claim-envelope.v1", protocol: "v3", issuedAt: "2026-11-05T00:00:00.000Z",
    runId: RUN_ID, stepId: STEP_ID, workflowStepId: "implement", storyId: "US-001", storyDbId: STORY_DB_ID,
    claimId: CLAIM_ID, claimGeneration: 1, claimAgentId: "feature-dev_developer", runtimeAgentId: "actual-native-developer",
    attempt: { attemptId: ATTEMPT_ID, generation: 1, fenceToken: "f".repeat(64) }, workdir, repo: workdir,
  });
}

function summaryFor(handoff: ReturnType<typeof nativeHandoff>) {
  const workdir = handoff.workdir;
  return buildClaimSummary({
    wfId: "feature-dev", role: "developer", claimFile: path.join(workdir, "claim.json"),
    outputFile: path.join(workdir, "output.json"), bootstrapFile: path.join(workdir, "bootstrap.sh"),
    stepId: STEP_ID, runId: RUN_ID, workdir, repo: workdir, storyId: "US-001",
    claimEnvelope: claimFor(workdir), v3ImplementationHandoff: handoff, input: "Untrusted prose has no authority.",
  });
}

function proposalIdentity(context: ReturnType<typeof createV3ImplementationContext>) {
  return { schema: "setfarm.v3-implementation-agent-proposal.v1", handoffHash: context.handoffHash,
    attemptId: context.handoff.attemptId, packetHash: context.handoff.packetHash,
    sliceHash: context.handoff.sliceHash, sourceBefore: context.handoff.sourceBefore };
}

function recoveryFixture(workdir: string) {
  const origin = compiledNativeCliFixture(true);
  const current = "export const nativeImplementation = 'needs repair';\n";
  const repaired = "export const nativeImplementation = 'repaired';\n";
  const hash = (contents: string) => createHash("sha256").update(contents).digest("hex");
  const findingSet = createFindingSetV1({ runId: RUN_ID, storyId: "US-001", packetHash: origin.slice.packetHash,
    sliceHash: origin.sliceHash, sourceRevision: CANDIDATE_SOURCE, findings: [{
      origin: "runtime", classification: "structured", invariantRef: "INV_OBSERVABLE_OUTCOME",
      expectedPredicateRef: "EVID_TASK_ADDED", sourceLocators: [{ path: "src/shared/write.ts", contentHash: hash(current) }],
      observedEvidenceRefs: ["5".repeat(64)], status: "open",
    }] });
  const compiled = compileLegacyImplementationSliceV2({ ...origin.compilerInput, sourceRevision: CANDIDATE_SOURCE,
    currentFiles: origin.compilerInput.currentFiles.map(file => file.pathRef === "PATH_SHARED_WRITE" ? { ...file, contentHash: hash(current) } : file),
    recovery: { schema: "setfarm.implementation-recovery-directive.v2", findingSet, sourceRevision: CANDIDATE_SOURCE,
      expectedSourceDelta: { schema: "setfarm.implementation-source-delta.v2", changes: [{ pathRef: "PATH_SHARED_WRITE", path: "src/shared/write.ts",
        before: { presence: "present", contentHash: hash(current) }, after: { presence: "present", contentHash: hash(repaired) } }] } },
  });
  assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
  if (compiled.status !== "compiled") throw Error("native recovery fixture rejected");
  const value = { ...origin, ...compiled };
  const initialHandoff = nativeHandoff(value, workdir);
  const handoff = { ...initialHandoff, sourceBefore: CANDIDATE_SOURCE, attemptGeneration: 2,
    recoveryAttempt: { attemptId: ATTEMPT_ID, claimId: CLAIM_ID, runId: RUN_ID, stepId: "implement", storyId: "US-001", generation: 2,
      attemptClass: "product_implementation", role: "developer", packetHash: value.slice.packetHash,
      compilationReportHash: value.compilationReportHash, sliceHash: value.sliceHash, sourceBefore: CANDIDATE_SOURCE,
      findingSetHash: findingSet.findingSetHash, recoveryCaseRevisionId: `RREV_${"6".repeat(64)}`, recoveryDispatchId: `RDISP_${"7".repeat(64)}` } };
  return { value, handoff, current, repaired };
}

// Task11 pure DATA fixtures. The source adapter consumes literal GraphQL/current
// byte inputs through its real producer. No network, Git, DB, model, accepted
// candidate, supervisor ownership or physical review observation is simulated.
async function nativeRawReviewArtifacts(options: {
  repositoryNodeId?: string; prNumber?: number; headSha?: string;
  threadPrefix?: string; commentPrefix?: string; body?: string; count?: number;
} = {}) {
  const prNumber = options.prNumber ?? 1925;
  const headSha = options.headSha ?? CANDIDATE_SOURCE.sha;
  const paths = ["src/index.ts", "src/shared/write.ts", "src/index.ts"];
  const source = createGithubReviewSource({
    fetchPage: async () => ({ data: { repository: {
      id: options.repositoryNodeId ?? "R_native_review_repository",
      pullRequest: { number: prNumber, state: "OPEN", headRefOid: headSha,
        reviewThreads: { nodes: paths.slice(0, options.count ?? 2).map((file, index) => ({
          id: `${options.threadPrefix ?? "PRRT_native"}_${index + 1}`,
          isResolved: false, isOutdated: false, path: file, line: 1, startLine: null,
          comments: { nodes: [{ id: `${options.commentPrefix ?? "PRRC_native"}_${index + 1}`,
            body: options.body ?? `Review the implementation at ${file}.`, author: { login: "reviewer" },
            createdAt: "2026-11-05T00:00:00.000Z", lastEditedAt: null }],
            pageInfo: { hasNextPage: false } },
        })), pageInfo: { hasNextPage: false, endCursor: null } },
      },
    } } }),
    readSource: async input => {
      assert.equal(input.headSha, headSha);
      assert.ok(paths.includes(input.path));
      return Buffer.from(NATIVE_JOIN_SOURCE);
    },
  });
  const read = await source.read({ prUrl: `https://github.com/setrox/generated/pull/${prNumber}`,
    repositoryPath: "/native-review-data-only" });
  return read.actionableThreads.map(evidence => {
    assert.equal(GithubReviewThreadEvidenceV1Schema.safeParse(evidence).success, true);
    assert.equal(evidence.currentSource.contentHash, createHash("sha256").update(NATIVE_JOIN_SOURCE).digest("hex"));
    const sealed = envelope("setfarm.github-review-thread-evidence.v1", evidence);
    return { artifactHash: hashCanonicalJson(sealed), evidence };
  });
}

function nativeReviewDataInput(artifacts: Awaited<ReturnType<typeof nativeRawReviewArtifacts>>, options: {
  metadataArtifacts?: Awaited<ReturnType<typeof nativeRawReviewArtifacts>>;
  changeMetadata?: (comment: GithubActionableReviewCommentV1, index: number) => GithubActionableReviewCommentV1;
  omitCommentMembership?: boolean;
} = {}) {
  const origin = compiledNativeCliFixture(true);
  const metadata = options.metadataArtifacts ?? artifacts;
  let findingSet = ingestGithubReviewThreadsV1({ schema: "setfarm.github-review-finding-set-input.v1",
    runId: RUN_ID, storyId: "US-001", packetHash: origin.slice.packetHash, sliceHash: origin.sliceHash,
    sourceRevision: CANDIDATE_SOURCE,
    reviews: artifacts.map((artifact, index) => {
      const evidence = metadata[index]!.evidence;
      const comment: GithubActionableReviewCommentV1 = {
        repositoryNodeId: evidence.repository.nodeId, prNumber: evidence.prNumber,
        threadId: evidence.threadId, commentId: evidence.comments[0]!.commentId,
        headSha: evidence.headSha, bodyRevisionHash: evidence.bodyRevisionHash,
        currentSource: { path: evidence.path, contentHash: evidence.currentSource.contentHash },
      };
      return { evidenceArtifactHash: artifact.artifactHash,
        comment: options.changeMetadata?.(comment, index) ?? comment };
    }),
  });
  if (options.omitCommentMembership) {
    findingSet = createFindingSetV1({ runId: findingSet.runId, storyId: findingSet.storyId,
      packetHash: findingSet.packetHash, sliceHash: findingSet.sliceHash, sourceRevision: findingSet.sourceRevision,
      findings: findingSet.findings.map(finding => {
        const { findingId: _id, ...draft } = finding;
        assert.ok(draft.externalRef);
        const { commentId: _comment, ...externalRef } = draft.externalRef;
        return { ...draft, externalRef };
      }) });
  }
  const paths = [...new Set(findingSet.findings.flatMap(finding => finding.sourceLocators.map(locator => locator.path)))].sort();
  const changes = paths.map(file => {
    const current = origin.slice.files.find(candidate => candidate.path === file)!;
    assert.ok(current && current.role !== "shared_readonly");
    assert.equal(current.contentHash, createHash("sha256").update(NATIVE_JOIN_SOURCE).digest("hex"));
    return { pathRef: current.pathRef, path: current.path,
      before: { presence: current.presence, contentHash: current.contentHash } };
  }).sort((left, right) => left.pathRef < right.pathRef ? -1 : left.pathRef > right.pathRef ? 1 : 0);
  const recovery = { schema: "setfarm.implementation-recovery-directive.v2", findingSet,
    sourceRevision: CANDIDATE_SOURCE, expectedSourceDelta: {
      schema: "setfarm.implementation-source-delta.v2", mode: "generated_repair",
      expectedDelta: { kind: "source_change", invariantRefs: ["INV_UNSTRUCTURED_REVIEW"], requiredPaths: paths },
      allowedPaths: paths, changes,
    } };
  return { origin, artifacts, paths, compileInput: { ...origin.compilerInput, sourceRevision: CANDIDATE_SOURCE, recovery } };
}

function compiledNativeReviewData(value: ReturnType<typeof nativeReviewDataInput>) {
  const compiled = compileLegacyImplementationSliceV2(value.compileInput);
  assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
  if (compiled.status !== "compiled") assert.fail("genuine generated-only review DATA must compile before handoff assertions");
  assert.equal(verifyLegacyImplementationSliceV2({ compilerInput: value.compileInput, slice: compiled.slice }).status, "verified");
  assert.equal(hashCanonicalJson(compiled.envelope), compiled.sliceHash);
  const handoff = nativeHandoff({ ...value.origin, ...compiled }, "/native-review-data-only");
  return { ...compiled, handoff: { ...handoff, sourceBefore: CANDIDATE_SOURCE, attemptGeneration: 2,
    executionAuthority: { role: "supervisor", attemptClass: "supervisor_repair" },
    findingSet: value.compileInput.recovery.findingSet, reviewEvidenceArtifacts: value.artifacts,
    recoveryAttempt: { attemptId: ATTEMPT_ID, claimId: CLAIM_ID, runId: RUN_ID, stepId: "implement", storyId: "US-001",
      generation: 2, attemptClass: "supervisor_repair", role: "supervisor", packetHash: compiled.slice.packetHash,
      compilationReportHash: value.origin.compilationReportHash, sliceHash: compiled.sliceHash, sourceBefore: CANDIDATE_SOURCE,
      findingSetHash: value.compileInput.recovery.findingSet.findingSetHash,
      recoveryCaseRevisionId: `RREV_${"6".repeat(64)}`, recoveryDispatchId: `RDISP_${"7".repeat(64)}` },
  } };
}

describe("native generated unstructured review DATA", () => {
  it("compiles genuine generated-only multi-review findings with exact current witnesses", async () => {
    const artifacts = await nativeRawReviewArtifacts();
    const value = nativeReviewDataInput(artifacts);
    const compiled = compiledNativeReviewData(value);
    const context = createV3ImplementationContext({ handoff: compiled.handoff });
    assert.deepEqual(context.writeAuthority, { mode: "recovery", allowedPaths: value.paths });
    assert.equal(context.handoff.executionAuthority.role, "supervisor");
    assert.equal(context.handoff.executionAuthority.attemptClass, "supervisor_repair");
    assert.deepEqual(context.handoff.nativeAuthority.baseRevision, SOURCE_BEFORE);
    assert.deepEqual(context.handoff.sourceBefore, CANDIDATE_SOURCE);
    assert.throws(() => createV3ImplementationContext({ handoff: { ...compiled.handoff,
      executionAuthority: { role: "developer", attemptClass: "product_implementation" },
      recoveryAttempt: { ...compiled.handoff.recoveryAttempt, role: "developer", attemptClass: "product_implementation" },
    } }), /executionAuthority|reviewEvidenceArtifacts/, "unstructured review DATA must retain the supervisor repair role");
    assert.ok(compiled.slice.recovery!.findingSet.findings.every(finding => finding.origin === "review"
      && finding.classification === "unstructured_review" && finding.invariantRef === "INV_UNSTRUCTURED_REVIEW"
      && finding.expectedPredicateRef === undefined));
    const recovery = value.compileInput.recovery;
    const exact = { ...recovery, expectedSourceDelta: { schema: "setfarm.implementation-source-delta.v2",
      changes: recovery.expectedSourceDelta.changes.map(change => ({ ...change,
        after: { presence: "present", contentHash: createHash("sha256").update("known exact replacement").digest("hex") } })) } };
    assert.equal(compileLegacyImplementationSliceV2({ ...value.compileInput, recovery: exact }).status, "rejected",
      "unstructured review must remain illegal in the historical exact branch");
    for (const delta of [
      { ...recovery.expectedSourceDelta, changes: recovery.expectedSourceDelta.changes.map(change => ({ ...change,
        after: { presence: "present", contentHash: createHash("sha256").update("fictional future repair").digest("hex") } })) },
      { ...recovery.expectedSourceDelta, allowedPaths: [...value.paths, "src/shared/read.ts"].sort() },
      { ...recovery.expectedSourceDelta, changes: recovery.expectedSourceDelta.changes.map(change => ({ ...change,
        before: { ...change.before, contentHash: createHash("sha256").update("stale current bytes").digest("hex") } })) },
    ]) assert.equal(compileLegacyImplementationSliceV2({ ...value.compileInput,
      recovery: { ...recovery, expectedSourceDelta: delta } }).status, "rejected");
    const staleFindingSet = createFindingSetV1({ runId: recovery.findingSet.runId, storyId: recovery.findingSet.storyId,
      packetHash: recovery.findingSet.packetHash, sliceHash: recovery.findingSet.sliceHash,
      sourceRevision: recovery.findingSet.sourceRevision, findings: recovery.findingSet.findings.map(finding => {
        const { findingId: _id, ...draft } = finding;
        return { ...draft, sourceLocators: draft.sourceLocators.map(locator => ({ ...locator,
          contentHash: createHash("sha256").update("other current source").digest("hex") })) };
      }) });
    assert.equal(compileLegacyImplementationSliceV2({ ...value.compileInput,
      recovery: { ...recovery, findingSet: staleFindingSet } }).status, "rejected",
    "review locator hashes must equal actual native current contentHash witnesses");
    const optionalComment = compiledNativeReviewData(nativeReviewDataInput(artifacts, { omitCommentMembership: true }));
    assert.doesNotThrow(() => createV3ImplementationContext({ handoff: optionalComment.handoff }));
  });

  it("requires a bijection from generated review findings to immutable thread artifacts", async () => {
    const artifacts = await nativeRawReviewArtifacts();
    const { handoff } = compiledNativeReviewData(nativeReviewDataInput(artifacts));
    assert.doesNotThrow(() => createV3ImplementationContext({ handoff }));
    const extra = (await nativeRawReviewArtifacts({ count: 3 }))[2]!;
    for (const supplied of [[artifacts[0]!, artifacts[0]!], artifacts.slice(0, 1), [...artifacts, extra]]) {
      assert.throws(() => createV3ImplementationContext({ handoff: { ...handoff, reviewEvidenceArtifacts: supplied } }),
        /reviewEvidenceArtifacts/, "duplicate, missing and unused immutable artifacts must refuse");
    }
  });

  it("binds the complete external identity of genuine generated review artifacts", async () => {
    const artifacts = await nativeRawReviewArtifacts();
    const baseline = compiledNativeReviewData(nativeReviewDataInput(artifacts));
    assert.doesNotThrow(() => createV3ImplementationContext({ handoff: baseline.handoff }));
    const alternate = await nativeRawReviewArtifacts({ repositoryNodeId: "R_other_native_repository", prNumber: 1926,
      threadPrefix: "PRRT_other_native", commentPrefix: "PRRC_other_native", body: "An independently produced edited conversation." });
    const other = alternate[0]!.evidence;
    for (const change of [
      { repositoryNodeId: other.repository.nodeId }, { prNumber: other.prNumber }, { threadId: other.threadId },
      { bodyRevisionHash: other.bodyRevisionHash }, { commentId: other.comments[0]!.commentId },
    ]) {
      const crossed = compiledNativeReviewData(nativeReviewDataInput(artifacts, {
        changeMetadata: (comment, index) => index === 0 ? { ...comment, ...change } : comment,
      }));
      assert.throws(() => createV3ImplementationContext({ handoff: crossed.handoff }), /reviewEvidenceArtifacts/,
        `well-formed compiled finding metadata crossed at ${Object.keys(change)[0]} must refuse`);
    }
    // The source adapter legitimately seals another head. Keep selected metadata
    // current so admission reaches the handoff's artifact/head comparison.
    const otherHead = await nativeRawReviewArtifacts({ headSha: "5".repeat(40) });
    const crossedHead = compiledNativeReviewData(nativeReviewDataInput(otherHead, { metadataArtifacts: artifacts }));
    assert.throws(() => createV3ImplementationContext({ handoff: crossedHead.handoff }), /reviewEvidenceArtifacts/);
    const wrongHash = { ...artifacts[0]!, artifactHash: alternate[0]!.artifactHash };
    assert.throws(() => createV3ImplementationContext({ handoff: { ...baseline.handoff,
      reviewEvidenceArtifacts: [wrongHash, artifacts[1]!] } }), /reviewEvidenceArtifacts/);
  });
});

describe("native PacketV3 context and owned evidence admission", () => {

  it("transports one complete native JSON fence through unchanged identity and scope compilation", () => {
    const context = createV3ImplementationContext({ handoff: nativeHandoff(compiledNativeCliFixture(), "/native-framed-report") });
    const input = { claim: claimFor(context.handoff.workdir), authority: context };
    const report = JSON.stringify({ ...proposalIdentity(context), disposition: "ready_for_evidence", summary: "Exact native source",
      changes: [{ path: "src/index.ts", summary: "owned source" }], commands: [{ commandId: "CMD_BUILD", outcome: "passed" }] }, null, 2);
    const bare = parseSubscriptionWorkflowReportV1({ ...input, assistantText: report });
    assert.equal(bare.output, report);
    const framed = "```json\n" + report + "\n```";
    const transported = parseSubscriptionWorkflowReportV1({ ...input, assistantText: framed });
    assert.equal(transported.output, report);
    assert.deepEqual(compileV3ImplementationAgentOutputV1(transported.output, context), compileV3ImplementationAgentOutputV1(bare.output, context));
    assert.throws(() => compileV3ImplementationAgentOutputV1(framed, context), /JSON_REQUIRED/);
    assert.equal(parseSubscriptionWorkflowReportV1({ ...input, assistantText: " \n```json\r\n" + report + "\r\n```\n " }).output, report);
    for (const changed of [{ attemptId: "ATT_crossed-native-attempt-00001" }, { handoffHash: "0".repeat(64) },
      { packetHash: "0".repeat(64) }, { sliceHash: "0".repeat(64) }, { sourceBefore: CANDIDATE_SOURCE },
      { changes: [{ path: "src/undeclared.ts", summary: "outside scope" }] }, { disposition: "self_certified_pass" }]) {
      assert.throws(() => parseSubscriptionWorkflowReportV1({ ...input, assistantText: "```json\n" + JSON.stringify({ ...JSON.parse(report), ...changed }) + "\n```" }));
    }
    for (const framed of ["Here is the result:\n```json\n" + report + "\n```", "```json\n" + report + "\n```\nDone.",
      "```json\n" + report + "\n```\n```json\n" + report + "\n```", "```json\n" + report,
      "```JSON\n" + report + "\n```", "```\n" + report + "\n```", "```json\n[]\n```", "```json\n{bad}\n```",
      "```json\n" + report + "\n````", "```json\n" + report + "\0\n```" ]) {
      assert.throws(() => parseSubscriptionWorkflowReportV1({ ...input, assistantText: framed }));
    }
  });

  it("counts native fenced raw UTF8 bytes before removing its wrapper while retaining the bare limit", () => {
    const context = createV3ImplementationContext({ handoff: nativeHandoff(compiledNativeCliFixture(), "/native-framed-capacity") });
    const input = { claim: claimFor(context.handoff.workdir), authority: context };
    const proposal = { ...proposalIdentity(context), disposition: "ready_for_evidence", summary: "Exact native source",
      changes: [{ path: "src/index.ts", summary: "owned source" }], notes: "" };
    const remaining = V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES - Buffer.byteLength(JSON.stringify(proposal));
    const atLimit = JSON.stringify({ ...proposal, notes: "x".repeat(remaining) });
    assert.equal(Buffer.byteLength(atLimit), V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES);
    assert.equal(parseSubscriptionWorkflowReportV1({ ...input, assistantText: "  " + atLimit + "  " }).output, "  " + atLimit + "  ");
    assert.throws(() => parseSubscriptionWorkflowReportV1({ ...input, assistantText: "```json\n" + atLimit + "\n```" }), /SIZE_INVALID/);
    const multibyte = "```json\n" + JSON.stringify({ ...proposal, notes: "é".repeat(Math.ceil(remaining / 2)) }) + "\n```";
    assert.ok(multibyte.length < V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES);
    assert.ok(Buffer.byteLength(multibyte) > V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES);
    assert.throws(() => parseSubscriptionWorkflowReportV1({ ...input, assistantText: multibyte }), /SIZE_INVALID/);
  });
  it("keeps native owned/shared writable files exact and refuses readonly or protected output", () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-scope-"));
    try {
      const value = compiledNativeCliFixture(true);
      const context = createV3ImplementationContext({ handoff: nativeHandoff(value, workdir) });
      assert.deepEqual(context.writeAuthority, { mode: "initial", allowedPaths: ["src/index.ts", "src/shared/write.ts"] });
      const ready = { ...proposalIdentity(context), disposition: "ready_for_evidence", summary: "Exact native scope",
        changes: [{ path: "src/index.ts", summary: "owned" }, { path: "src/shared/write.ts", summary: "shared writable" }] };
      assert.equal(compileV3ImplementationAgentOutputV1(JSON.stringify(ready), context).output.disposition, "ready_for_evidence");
      for (const path of ["src/shared/read.ts", ".setfarm/implement-context.json", ".git/config", "src/undeclared.ts"]) {
        assert.throws(() => compileV3ImplementationAgentOutputV1(JSON.stringify({ ...ready, changes: [{ path, summary: "escape" }] }), context), /OUTSIDE_AUTHORITY/);
      }
      for (const change of [{ attemptId: "ATT_crossed-native-attempt-00001" }, { handoffHash: "0".repeat(64) }, { sourceBefore: CANDIDATE_SOURCE }]) {
        assert.throws(() => compileV3ImplementationAgentOutputV1(JSON.stringify({ ...ready, ...change }), context), /IDENTITY_MISMATCH/);
      }
    } finally { fs.rmSync(workdir, { recursive: true, force: true }); }
  });

  it("narrows native recovery to current finding/delta paths while retaining original origin source", () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-recovery-context-"));
    try {
      const { handoff } = recoveryFixture(workdir);
      const context = createV3ImplementationContext({ handoff });
      assert.deepEqual(context.writeAuthority, { mode: "recovery", allowedPaths: ["src/shared/write.ts"] });
      assert.deepEqual(context.handoff.nativeAuthority.baseRevision, SOURCE_BEFORE);
      assert.deepEqual(context.handoff.sourceBefore, CANDIDATE_SOURCE);
      for (const change of [
        { sourceBefore: SOURCE_BEFORE }, { findingSetHash: "0".repeat(64) }, { recoveryCaseRevisionId: "RREV_invalid" },
        { recoveryDispatchId: "RDISP_invalid" }, { attemptClass: "infrastructure_retry" }, { role: "supervisor" },
        { fenceToken: "a".repeat(64) }, { recoveryDeliveryLease: { ownerInstanceId: "forged-owner", leaseToken: "forged-lease-token" } },
      ]) {
        assert.throws(() => createV3ImplementationContext({ handoff: { ...handoff, recoveryAttempt: { ...handoff.recoveryAttempt, ...change } } }));
      }
      assert.throws(() => createV3ImplementationContext({ handoff: { ...handoff, recoveryAttempt: undefined } }));
      const ready = { ...proposalIdentity(context), disposition: "ready_for_evidence", summary: "Recovery",
        changes: [{ path: "src/index.ts", summary: "owned but not in this recovery delta" }] };
      assert.throws(() => compileV3ImplementationAgentOutputV1(JSON.stringify(ready), context), /OUTSIDE_AUTHORITY/);
    } finally { fs.rmSync(workdir, { recursive: true, force: true }); }
  });

  it("proves native source refusal from contentHash rather than treating every unchanged file as mismatched", () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-refusal-"));
    try {
      const value = compiledNativeCliFixture();
      fs.mkdirSync(path.join(workdir, "src"));
      fs.writeFileSync(path.join(workdir, "src/index.ts"), NATIVE_JOIN_SOURCE);
      const context = createV3ImplementationContext({ handoff: nativeHandoff(value, workdir) });
      const output = compileV3ImplementationAgentOutputV1(JSON.stringify({ ...proposalIdentity(context), disposition: "refused",
        refusal: { code: "SOURCE_SNAPSHOT_MISMATCH", summary: "Source differs", mismatchedPathRefs: ["PATH_APP"] } }), context).output;
      assert.equal(output.disposition, "refused");
      if (output.disposition !== "refused") throw Error("expected typed refusal");
      assert.throws(() => buildV3ImplementationRefusalDecision({ context, output, observedSource: SOURCE_BEFORE,
        fileSnapshots: captureV3RefusalFileSnapshots(context) }), /SOURCE_MISMATCH_NOT_PROVEN/);
      fs.writeFileSync(path.join(workdir, "src/index.ts"), "export const nativeImplementation = false;\n");
      const decision = buildV3ImplementationRefusalDecision({ context, output, observedSource: CANDIDATE_SOURCE,
        fileSnapshots: captureV3RefusalFileSnapshots(context) });
      assert.equal(decision.recoveryCase.owner, "compiler");
      assert.deepEqual(decision.findingSet.findings[0]?.sourceLocators, [{ path: "src/index.ts",
        contentHash: createHash("sha256").update("export const nativeImplementation = false;\n").digest("hex") }]);
    } finally { fs.rmSync(workdir, { recursive: true, force: true }); }
  });

  it("bounds failed native evidence findings to the authenticated current recovery delta", async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-evidence-findings-"));
    try {
      const { value, current } = recoveryFixture(workdir);
      fs.mkdirSync(path.join(workdir, "src/shared"), { recursive: true });
      fs.writeFileSync(path.join(workdir, "src/index.ts"), NATIVE_JOIN_SOURCE);
      fs.writeFileSync(path.join(workdir, "src/shared/read.ts"), NATIVE_JOIN_SOURCE);
      fs.writeFileSync(path.join(workdir, "src/shared/write.ts"), current);
      fs.writeFileSync(path.join(workdir, "package.json"), JSON.stringify({ scripts: { build: "node -e \"process.exit(7)\"" } }));
      const result = await runImplementEvidenceIfRequested({ runId: RUN_ID, storyId: "US-001", workdir, stackPackId: "node-cli",
        v3: { slice: value.slice, sliceHash: value.sliceHash, attemptId: ATTEMPT_ID, sourceRevision: CANDIDATE_SOURCE } });
      assert.equal(result.ok, false, "the real declared build must fail before native finding conversion");
      const bundle = result.canonicalEvidence?.bundle;
      assert.ok(bundle, "the owned runner must produce canonical failed evidence");
      const findingSet = createFindingSetFromEvidenceBundleV2({ workdir, slice: value.slice, sliceHash: value.sliceHash,
        sourceRevision: CANDIDATE_SOURCE, bundle });
      assert.ok(findingSet, "required native failures must produce typed findings");
      assert.deepEqual(findingSet.sourceRevision, CANDIDATE_SOURCE);
      assert.deepEqual(findingSet.findings.map(finding => finding.expectedPredicateRef).sort(),
        bundle.predicates.filter(predicate => predicate.required && predicate.verdict !== "pass").map(predicate => predicate.predicateRef).sort());
      const expectedLocators = [{ path: "src/shared/write.ts", contentHash: createHash("sha256").update(current).digest("hex") }];
      assert.ok(findingSet.findings.every(finding => JSON.stringify(finding.sourceLocators) === JSON.stringify(expectedLocators)));
      assert.throws(() => createFindingSetFromEvidenceBundleV2({ workdir, slice: value.slice, sliceHash: value.sliceHash,
        sourceRevision: SOURCE_BEFORE, bundle }), /IDENTITY_MISMATCH|SOURCE/);
      assert.throws(() => createFindingSetFromEvidenceBundleV2({ workdir, slice: value.slice, sliceHash: "0".repeat(64),
        sourceRevision: CANDIDATE_SOURCE, bundle }), /IDENTITY_MISMATCH|HASH/);
    } finally { fs.rmSync(workdir, { recursive: true, force: true }); }
  });

  it("keeps native context at the existing UTF-8 capacity without transport side effects", () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-context-capacity-"));
    try {
      const context = createV3ImplementationContext({ handoff: nativeHandoff(compiledNativeCliFixture(), workdir) });
      const atCapacity = { ...context, rules: Array.from({ length: 100 }, () => "x".repeat(2_000)),
        outputContract: { ...context.outputContract, format: "x".repeat(20_000) } };
      const base = Buffer.byteLength(JSON.stringify(atCapacity, null, 2) + "\n");
      // Preserve schema-valid fields while consuming exactly the existing cap.
      // Native context includes complete original witnesses; no capacity is raised.
      const target = 256 * 1024;
      assert.ok(base < target, "fixture must leave some capacity for an exact UTF-8 boundary assertion");
      const producerEntries = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`native_tool_${index}`, "v".repeat(200)]));
      const oversized = JSON.parse(serializeV3ImplementationContext(context));
      oversized.rules = Array.from({ length: 100 }, () => "x".repeat(2_000));
      // Valid inert output-contract JSON Schema fields can be large and are
      // hash-bound; they do not alter native compiler/source authority.
      oversized.outputContract.jsonSchema = { ...oversized.outputContract.jsonSchema, $comment: JSON.stringify(producerEntries) };
      oversized.outputContract.jsonSchemaHash = hashCanonicalJson(oversized.outputContract.jsonSchema);
      assert.ok(Buffer.byteLength(JSON.stringify(oversized, null, 2) + "\n") > target);
      assert.throws(() => parseV3ImplementationContext(oversized), /maximum is 262144|CAPACITY/);
      assert.throws(() => planSubscriptionWorkflowHandoffV1({ claim: claimFor(workdir), authority: oversized }), /maximum is 262144|CAPACITY/);
      assert.equal(fs.existsSync(path.join(workdir, ".setfarm")), false);
    } finally { fs.rmSync(workdir, { recursive: true, force: true }); }
  });
  it("rejects native crossed envelopes refs source origin and claim before transport", () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-context-negative-"));
    try {
      fs.mkdirSync(path.join(workdir, "src"));
      fs.writeFileSync(path.join(workdir, "src/index.ts"), NATIVE_JOIN_SOURCE);
      const value = compiledNativeCliFixture();
      const handoff = nativeHandoff(value, workdir);
      assert.ok(summaryFor(handoff).canonicalImplementationContext, "valid native baseline must admit before testing refusals");
      for (const [label, change] of [
        ["legacy ref", { sliceRef: `SLICE_US_001_${value.sliceHash.slice(0, 16).toUpperCase()}` }],
        ["wrong slice hash", { sliceHash: "a".repeat(64) }],
        ["wrong report", { compilationReportHash: "b".repeat(64) }],
        ["wrong plan ref", { evidencePlanRef: handoff.sliceRef }],
        ["wrong source", { sourceBefore: CANDIDATE_SOURCE }],
        ["wrong producer", { artifactProducer: { ...NATIVE_JOIN_PRODUCER, pass: "crossed-native-producer" } }],
        ["wrong packet domain", { packetEnvelope: envelope("setfarm.product-build-packet.v4", value.slice.packet) }],
        ["wrong report domain", { compilationReportEnvelope: envelope("setfarm.product-compilation-report.v2", value.compilationReportEnvelope.payload) }],
        ["crossed claim", { claimId: CLAIM_ID + 1 }],
        ["crossed generation", { attemptGeneration: 2 }],
        ["unearned fallback", { executionProfile: resolveV3ExecutionProfile("fallback") }],
      ]) {
        assert.throws(() => summaryFor({ ...handoff, ...change }), undefined, String(label));
      }
    } finally { fs.rmSync(workdir, { recursive: true, force: true }); }
  });

  it("transports every native witness byte across protected readable parts", () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-context-transport-"));
    try {
      fs.mkdirSync(path.join(workdir, "src"));
      fs.writeFileSync(path.join(workdir, "src/index.ts"), NATIVE_JOIN_SOURCE);
      const handoff = nativeHandoff(compiledNativeCliFixture(), workdir);
      const authority = JSON.parse(JSON.stringify(summaryFor(handoff).canonicalImplementationContext));
      const plan = planSubscriptionWorkflowHandoffV1({ claim: claimFor(workdir), authority });
      const parts = plan.files.filter(file => file.kind === "canonical").sort((left, right) => left.byteOffset - right.byteOffset);
      assert.ok(parts.length > 1);
      const reconstructed = parts.map(part => part.contents).join("");
      assert.equal(reconstructed, JSON.stringify(authority, null, 2) + "\n");
      assert.deepEqual(JSON.parse(reconstructed).handoff.packetEnvelope, handoff.packetEnvelope);
      assert.deepEqual(JSON.parse(reconstructed).handoff.compilationReportEnvelope, handoff.compilationReportEnvelope);
      assert.ok(plan.files.length <= 256);
      assert.ok(parts.every(part => Buffer.byteLength(part.contents) <= 12 * 1024));
      assert.deepEqual(plan.readOnlyControlPaths, plan.files.map(file => file.path));
      const widened = { ...authority, writeAuthority: { mode: "initial", allowedPaths: ["src/index.ts", ".setfarm/implement-context.json"] } };
      assert.throws(() => planSubscriptionWorkflowHandoffV1({ claim: claimFor(workdir), authority: widened }));
    } finally { fs.rmSync(workdir, { recursive: true, force: true }); }
  });
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
