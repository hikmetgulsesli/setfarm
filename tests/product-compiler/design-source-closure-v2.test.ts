import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { before, describe, it } from "node:test";

import { SemanticArtifactEnvelopeV1Schema } from "../../src/product-compiler/artifact-store.js";
import { canonicalJsonBytes, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { compileDesignSourceClosureV2 } from "../../src/product-compiler/design-source-closure-compiler-v2.js";
import {
  createProductCompilationArtifactManifestV1,
  ProductCompilationProjectionReceiptV1Schema,
} from "../../src/product-compiler/product-compilation-attempt-workspace.js";
import { produceDesignInteractionGraphV2 } from "../../src/product-compiler/producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { captureStitchRenderedSemanticsV2 } from "../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import { DesignSourceClosureV2Schema } from "../../src/product-compiler/schemas/design-source-closure-v2.js";
import { ProductBuildPacketV3Schema } from "../../src/product-compiler/schemas/product-build-packet-v3.js";
import { ProductCompilationAttemptV1Schema } from "../../src/product-compiler/schemas/product-compilation-attempt-v1.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);
const HASH_F = "f".repeat(64);
const HASH_0 = "0".repeat(64);

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function semanticArtifact(artifactType: string, payload: unknown) {
  const envelope = SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer: {
      pass: "design_source_closure_v2_test",
      codeSha: "e4db8ae",
      toolVersions: { node: process.versions.node },
    },
    payload,
  });
  return {
    reference: {
      artifactType,
      envelopeHash: hashCanonicalJson(envelope),
      payloadHash: hashCanonicalJson(payload),
    },
    envelope,
  };
}

function resealSemanticArtifact(value: any): void {
  value.reference.payloadHash = hashCanonicalJson(value.envelope.payload);
  value.reference.envelopeHash = hashCanonicalJson(value.envelope);
}

function acceptedAttempt(outputRefs: Record<string, string>) {
  const attemptId = `PCA_${sha256("design-source-closure-v2-attempt")}`;
  const outputSealHash = hashCanonicalJson({
    schema: "setfarm.product-compilation-output-seal.v1",
    attemptRef: attemptId,
    disposition: "accepted",
    outputRefs,
  });
  return ProductCompilationAttemptV1Schema.parse({
    schema: "setfarm.product-compilation-attempt.v1",
    attemptId,
    runId: "closure-v2-test-run",
    originClaimId: 41,
    ownerClaimId: 42,
    passKind: "design_source_generation",
    authorityHash: sha256("authority"),
    requestHash: sha256("request"),
    ordinal: 1,
    retryAuthority: null,
    generation: 1,
    fenceToken: sha256("fence"),
    state: "sealed",
    disposition: "accepted",
    lease: null,
    dispatch: {
      intentCommittedAt: "2026-07-16T08:00:00.000Z",
      startedAt: "2026-07-16T08:00:01.000Z",
      finishedAt: "2026-07-16T08:00:02.000Z",
      externalOperationId: "stitch-operation-1",
    },
    outputRefs,
    outputSealHash,
    failure: null,
    attemptLocator: ".setfarm/product-compilation-attempts/test",
    createdAt: "2026-07-16T08:00:00.000Z",
    updatedAt: "2026-07-16T08:00:02.000Z",
  });
}

async function buildCompilerInput(): Promise<any> {
  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("unreachable");
  const producedTargets = produceDesignGenerationTargetsV2(compiled.productSpec);
  assert.equal(producedTargets.status, "produced", JSON.stringify(producedTargets));
  if (producedTargets.status !== "produced") throw new Error("unreachable");

  const generationTargets = producedTargets.generationTargets;
  const target = generationTargets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const statusObservable = target.requiredObservableSelectors.find((observable) =>
    observable.selector.kind === "accessibility")!;
  assert.equal(statusObservable.selector.kind, "accessibility");
  if (statusObservable.selector.kind !== "accessibility") throw new Error("unreachable");
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
    surfaceRef !== statusObservable.selector.surfaceRef)!;
  const htmlBytes = validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}">`,
    `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
    `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
    `<section data-surface-id="${statusObservable.selector.surfaceRef}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
    "</main>",
  ].join(""), "closure-v2");
  const screenshotBytes = validStitchPng(181);
  const screenId = "screen-closure-v2";
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "closure-v2-test",
    batches: [{
      stageId: "stage-closure-v2",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: [{
        screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(screenId, htmlBytes, screenshotBytes),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }],
    }],
  };
  const artifacts = [{ screenId, htmlBytes, screenshotBytes }];
  const rendered = await captureStitchRenderedSemanticsV2({
    generationTargets,
    directResponseEvidence,
    artifacts,
    deviceType: "DESKTOP",
  });
  const selected = selectStitchTargetCandidatesV2({
    generationTargets,
    directResponseEvidence,
    renderedSemantics: rendered.artifact,
    artifacts,
  });
  assert.equal(selected.status, "produced", JSON.stringify(selected));
  if (selected.status !== "produced") throw new Error("unreachable");
  const bound = bindStitchTargetCandidateSelectionsV3({
    generationTargets,
    candidateSelection: selected.candidateSelection,
    renderedSemantics: rendered.artifact,
  });
  assert.equal(bound.status, "produced", JSON.stringify(bound));
  if (bound.status !== "produced") throw new Error("unreachable");
  const graph = produceDesignInteractionGraphV2({
    productSpec: compiled.productSpec,
    generationTargets,
    renderedSemantics: rendered.artifact,
    candidateSelection: selected.candidateSelection,
    responseBindings: bound.responseBindings,
  });

  const generationTargetsArtifact = semanticArtifact(
    "setfarm.design-generation-targets.v2",
    generationTargets,
  );
  const directResponseEvidenceArtifact = semanticArtifact(
    "setfarm.stitch-direct-response-evidence.v2",
    directResponseEvidence,
  );
  const renderedSemanticsArtifact = semanticArtifact(
    "setfarm.stitch-rendered-semantics.v2",
    rendered.artifact,
  );
  const candidateSelectionArtifact = semanticArtifact(
    "setfarm.stitch-target-candidate-selection.v2",
    selected.candidateSelection,
  );
  const responseBindingsArtifact = semanticArtifact(
    "setfarm.stitch-target-response-bindings.v3",
    bound.responseBindings,
  );
  const designGraphArtifact = semanticArtifact(
    "setfarm.design-interaction-graph.v2",
    graph.designGraph,
  );
  const outputRefs = {
    directResponseEvidenceHash: directResponseEvidenceArtifact.reference.payloadHash,
    renderedSemanticsHash: renderedSemanticsArtifact.reference.payloadHash,
    candidateSelectionHash: candidateSelectionArtifact.reference.payloadHash,
    responseBindingsHash: responseBindingsArtifact.reference.payloadHash,
  };
  const attempt = acceptedAttempt(outputRefs);
  const outputArtifacts = [
    ["directResponseEvidenceHash", directResponseEvidenceArtifact, "direct-response-evidence.json"],
    ["renderedSemanticsHash", renderedSemanticsArtifact, "rendered-semantics.json"],
    ["candidateSelectionHash", candidateSelectionArtifact, "candidate-selection.json"],
    ["responseBindingsHash", responseBindingsArtifact, "response-bindings.json"],
  ] as const;
  const manifest = createProductCompilationArtifactManifestV1({
    attempt,
    authorityArtifacts: outputArtifacts.map(([outputRef, artifact, locator]) => ({
      outputRef,
      source: {
        area: "selection" as const,
        locator,
        contentHash: artifact.reference.payloadHash,
        byteLength: canonicalJsonBytes(artifact.envelope.payload).length,
      },
    })),
    projectionArtifacts: outputArtifacts.map(([, artifact, locator]) => ({
      source: {
        area: "selection" as const,
        locator,
        contentHash: artifact.reference.payloadHash,
        byteLength: canonicalJsonBytes(artifact.envelope.payload).length,
      },
      targetPath: `stitch/${locator}`,
    })),
  });
  const receiptArtifacts = manifest.projectionArtifacts
    .map((artifact) => ({
      path: artifact.targetPath,
      contentHash: artifact.source.contentHash,
      byteLength: artifact.source.byteLength,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const receiptPayload = {
    schema: "setfarm.product-compilation-projection-receipt.v1" as const,
    attemptId: attempt.attemptId,
    outputSealHash: attempt.outputSealHash,
    manifestHash: manifest.manifestHash,
    projectionHash: hashCanonicalJson({
      schema: "setfarm.product-compilation-projection-content.v1",
      attemptId: attempt.attemptId,
      artifacts: receiptArtifacts,
    }),
    artifacts: receiptArtifacts,
  };
  const projectionReceipt = ProductCompilationProjectionReceiptV1Schema.parse({
    ...receiptPayload,
    receiptHash: hashCanonicalJson(receiptPayload),
  });
  return {
    kind: "stitch",
    productSpecV2Hash: hashCanonicalJson(compiled.productSpec),
    generationTargets: generationTargetsArtifact,
    directResponseEvidence: directResponseEvidenceArtifact,
    renderedSemantics: renderedSemanticsArtifact,
    candidateSelection: candidateSelectionArtifact,
    responseBindings: responseBindingsArtifact,
    designGraph: designGraphArtifact,
    acceptedAttempt: attempt,
    artifactManifest: manifest,
    projectionReceipt,
  };
}

function rejectionCodes(result: ReturnType<typeof compileDesignSourceClosureV2>): string[] {
  assert.equal(result.status, "rejected", JSON.stringify(result));
  return result.status === "rejected" ? result.issues.map((entry) => entry.code) : [];
}

let validCompilerInput: any;

before(async () => {
  validCompilerInput = await buildCompilerInput();
});

describe("Design Source Closure v2", { concurrency: 1 }, () => {
  it("compiles one exact v2 Stitch closure and an exact no-design closure", () => {
    const result = compileDesignSourceClosureV2(structuredClone(validCompilerInput));
    assert.equal(result.status, "compiled", JSON.stringify(result));
    if (result.status !== "compiled") return;
    assert.equal(result.closure.kind, "stitch");
    if (result.closure.kind !== "stitch") return;
    assert.equal(result.closure.generationTargets.artifactType, "setfarm.design-generation-targets.v2");
    assert.equal(result.closure.renderedSemantics.artifactType, "setfarm.stitch-rendered-semantics.v2");
    assert.equal(result.closure.candidateSelection.artifactType, "setfarm.stitch-target-candidate-selection.v2");
    assert.equal(result.closure.responseBindings.artifactType, "setfarm.stitch-target-response-bindings.v3");
    assert.equal(result.closure.designGraph.artifactType, "setfarm.design-interaction-graph.v2");
    assert.equal(result.closure.acceptedAttempt.attemptRef, validCompilerInput.acceptedAttempt.attemptId);
    assert.equal(result.closure.artifactManifest.artifactHash, validCompilerInput.artifactManifest.manifestHash);
    assert.equal(result.closure.projectionReceipt.artifactHash, validCompilerInput.projectionReceipt.receiptHash);

    assert.deepEqual(compileDesignSourceClosureV2({ kind: "none" }), {
      status: "compiled",
      closure: {
        schema: "setfarm.design-source-closure.v2",
        kind: "none",
        reason: "product_delivery_design_not_required",
      },
    });
    assert.equal(compileDesignSourceClosureV2({ kind: "none", inferredGraph: HASH_A }).status, "rejected");
  });

  it("rejects v1 artifact substitution and forged envelope or payload identities", () => {
    const wrongType = structuredClone(validCompilerInput);
    wrongType.renderedSemantics.envelope.artifactType = "setfarm.stitch-rendered-semantics.v1";
    resealSemanticArtifact(wrongType.renderedSemantics);
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(wrongType)).includes(
      "CONTRACT_DESIGN_SOURCE_CHILD_ARTIFACT_TYPE_MISMATCH",
    ));

    const forgedEnvelope = structuredClone(validCompilerInput);
    forgedEnvelope.designGraph.envelope.producer.pass = "forged-producer";
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(forgedEnvelope)).includes(
      "CONTRACT_DESIGN_SOURCE_CHILD_ENVELOPE_HASH_MISMATCH",
    ));

    const forgedPayloadRef = structuredClone(validCompilerInput);
    forgedPayloadRef.responseBindings.reference.payloadHash = sha256("forged-payload-ref");
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(forgedPayloadRef)).includes(
      "CONTRACT_DESIGN_SOURCE_CHILD_PAYLOAD_HASH_MISMATCH",
    ));
  });

  it("rejects a fully rehashed child whose nested cross-hash no longer closes", () => {
    const forged = structuredClone(validCompilerInput);
    forged.renderedSemantics.envelope.payload.generationTargetsHash = sha256("other-targets");
    resealSemanticArtifact(forged.renderedSemantics);
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(forged)).includes(
      "CONTRACT_DESIGN_SOURCE_HASH_CHAIN_MISMATCH",
    ));

    const forgedGraph = structuredClone(validCompilerInput);
    forgedGraph.designGraph.envelope.payload.responseBindingsHash = sha256("other-graph-binding");
    resealSemanticArtifact(forgedGraph.designGraph);
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(forgedGraph)).includes(
      "CONTRACT_DESIGN_SOURCE_HASH_CHAIN_MISMATCH",
    ));
  });

  it("rejects accepted-attempt output substitution and forged output seals", () => {
    const substituted = structuredClone(validCompilerInput);
    substituted.acceptedAttempt.outputRefs.responseBindingsHash = sha256("other-bindings");
    substituted.acceptedAttempt.outputSealHash = hashCanonicalJson({
      schema: "setfarm.product-compilation-output-seal.v1",
      attemptRef: substituted.acceptedAttempt.attemptId,
      disposition: "accepted",
      outputRefs: substituted.acceptedAttempt.outputRefs,
    });
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(substituted)).includes(
      "CONTRACT_DESIGN_SOURCE_ATTEMPT_OUTPUT_REFS_MISMATCH",
    ));

    const selfReferential = structuredClone(validCompilerInput);
    selfReferential.acceptedAttempt.outputRefs.designSourceClosureHash = sha256("closure");
    selfReferential.acceptedAttempt.outputSealHash = hashCanonicalJson({
      schema: "setfarm.product-compilation-output-seal.v1",
      attemptRef: selfReferential.acceptedAttempt.attemptId,
      disposition: "accepted",
      outputRefs: selfReferential.acceptedAttempt.outputRefs,
    });
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(selfReferential)).includes(
      "CONTRACT_DESIGN_SOURCE_ATTEMPT_OUTPUT_REFS_MISMATCH",
    ));

    const forgedSeal = structuredClone(validCompilerInput);
    forgedSeal.acceptedAttempt.outputSealHash = sha256("forged-seal");
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(forgedSeal)).includes(
      "CONTRACT_DESIGN_SOURCE_OUTPUT_SEAL_HASH_MISMATCH",
    ));
  });

  it("rejects canonical manifest and projection-receipt rebinding attacks", () => {
    const manifestAttack = structuredClone(validCompilerInput);
    manifestAttack.artifactManifest.attemptId = `PCA_${sha256("other-attempt")}`;
    const { manifestHash: _manifestHash, ...manifestPayload } = manifestAttack.artifactManifest;
    manifestAttack.artifactManifest.manifestHash = hashCanonicalJson(manifestPayload);
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(manifestAttack)).includes(
      "CONTRACT_DESIGN_SOURCE_MANIFEST_BINDING_MISMATCH",
    ));

    const receiptAttack = structuredClone(validCompilerInput);
    receiptAttack.projectionReceipt.manifestHash = sha256("other-manifest");
    const { receiptHash: _receiptHash, ...receiptPayload } = receiptAttack.projectionReceipt;
    receiptAttack.projectionReceipt.receiptHash = hashCanonicalJson(receiptPayload);
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(receiptAttack)).includes(
      "CONTRACT_DESIGN_SOURCE_PROJECTION_BINDING_MISMATCH",
    ));

    const projectedBytesAttack = structuredClone(validCompilerInput);
    projectedBytesAttack.projectionReceipt.artifacts[0].contentHash = sha256("other-content");
    projectedBytesAttack.projectionReceipt.projectionHash = hashCanonicalJson({
      schema: "setfarm.product-compilation-projection-content.v1",
      attemptId: projectedBytesAttack.acceptedAttempt.attemptId,
      artifacts: projectedBytesAttack.projectionReceipt.artifacts,
    });
    const { receiptHash: _oldReceiptHash, ...projectedReceiptPayload } =
      projectedBytesAttack.projectionReceipt;
    projectedBytesAttack.projectionReceipt.receiptHash = hashCanonicalJson(projectedReceiptPayload);
    assert.ok(rejectionCodes(compileDesignSourceClosureV2(projectedBytesAttack)).includes(
      "CONTRACT_DESIGN_SOURCE_PROJECTION_BINDING_MISMATCH",
    ));
  });

  it("keeps the v1 and v2 closure schemas disjoint", () => {
    const result = compileDesignSourceClosureV2(structuredClone(validCompilerInput));
    assert.equal(result.status, "compiled");
    if (result.status !== "compiled") return;
    const v1 = structuredClone(result.closure) as any;
    v1.schema = "setfarm.design-source-closure.v1";
    assert.equal(DesignSourceClosureV2Schema.safeParse(v1).success, false);
  });
});

function packetV3(designSourceKind: "none" | "stitch" = "stitch") {
  return {
    schema: "setfarm.product-build-packet.v3" as const,
    packetVersion: 3 as const,
    parentPacketHashes: [HASH_A],
    designSourceKind,
    productSpecV2Hash: HASH_B,
    designGraphV2Hash: designSourceKind === "stitch" ? HASH_C : null,
    buildTopologyV1Hash: HASH_D,
    storyPlanV2Hash: HASH_E,
    runtimeDataContractHash: HASH_F,
    runtimeEvidenceContractHash: HASH_0,
    designSourceClosureV2Hash: HASH_A,
    compiler: { version: "4.0.0", codeSha: "e4db8ae" },
    validationIds: ["VALIDATE_DESIGN_SOURCE_CLOSURE_V2"],
  };
}

describe("Product Build Packet v3", () => {
  it("accepts exact Stitch and no-design versioned hash manifests", () => {
    assert.deepEqual(ProductBuildPacketV3Schema.parse(packetV3()), packetV3());
    assert.deepEqual(ProductBuildPacketV3Schema.parse(packetV3("none")), packetV3("none"));
  });

  it("enforces graph/design-source and runtime-contract cross-presence", () => {
    assert.equal(ProductBuildPacketV3Schema.safeParse({
      ...packetV3(),
      designGraphV2Hash: null,
    }).success, false);
    assert.equal(ProductBuildPacketV3Schema.safeParse({
      ...packetV3("none"),
      designGraphV2Hash: HASH_C,
    }).success, false);

    const missingRuntimeEvidence: any = packetV3();
    delete missingRuntimeEvidence.runtimeEvidenceContractHash;
    assert.equal(ProductBuildPacketV3Schema.safeParse(missingRuntimeEvidence).success, false);
    const noRuntimeHashes: any = packetV3();
    delete noRuntimeHashes.runtimeDataContractHash;
    delete noRuntimeHashes.runtimeEvidenceContractHash;
    assert.equal(ProductBuildPacketV3Schema.safeParse(noRuntimeHashes).success, true);
  });

  it("rejects v2 inference fields, duplicate identities, and embellishment", () => {
    const inferredV2: any = packetV3();
    inferredV2.productSpecHash = inferredV2.productSpecV2Hash;
    delete inferredV2.productSpecV2Hash;
    assert.equal(ProductBuildPacketV3Schema.safeParse(inferredV2).success, false);
    assert.equal(ProductBuildPacketV3Schema.safeParse({
      ...packetV3(),
      parentPacketHashes: [HASH_A, HASH_A],
    }).success, false);
    assert.equal(ProductBuildPacketV3Schema.safeParse({
      ...packetV3(),
      validationIds: ["VALIDATE_V2", "VALIDATE_V2"],
    }).success, false);
    assert.equal(ProductBuildPacketV3Schema.safeParse({
      ...packetV3(),
      generatedAt: "2026-07-16T08:00:00.000Z",
    }).success, false);
  });
});
