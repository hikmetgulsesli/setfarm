import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { before, describe, it } from "node:test";
import { createContext, runInContext } from "node:vm";

import { SemanticArtifactEnvelopeV1Schema } from "../../src/product-compiler/artifact-envelope.js";
import { canonicalJsonBytes, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  compileGeneratedSourceReceiptsV2,
  verifyGeneratedSourceReceiptsV2,
} from "../../src/product-compiler/generated-source-receipt-v2.js";
import {
  createProductCompilationArtifactManifestV1,
  ProductCompilationProjectionReceiptV1Schema,
} from "../../src/product-compiler/product-compilation-attempt-workspace.js";
import { ProductCompilationAttemptV1Schema } from "../../src/product-compiler/schemas/product-compilation-attempt-v1.js";
import {
  generatedSourceReceiptEntryAuthorityV2,
  generatedSourceReceiptRefV2,
  hashGeneratedSourceReceiptEntryCommitmentV2,
  hashGeneratedSourceReceiptSetCommitmentV2,
} from "../../src/product-compiler/schemas/generated-source-receipt-v2.js";
import { buildStitchProductBuildPacketV3Contracts } from "./fixtures/product-build-packet-v3.js";

const producer = {
  pass: "generated-source-receipt-v2-test",
  codeSha: "8e555c3",
  toolVersions: { node: process.versions.node },
};

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function semanticArtifact(artifactType: string, payload: unknown) {
  const envelope = SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer,
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

function acceptedAttempt(outputRefs: Record<string, string>) {
  const attemptId = `PCA_${sha256("generated-source-receipt-v2-attempt")}`;
  const outputSealHash = hashCanonicalJson({
    schema: "setfarm.product-compilation-output-seal.v1",
    attemptRef: attemptId,
    disposition: "accepted",
    outputRefs,
  });
  return ProductCompilationAttemptV1Schema.parse({
    schema: "setfarm.product-compilation-attempt.v1",
    attemptId,
    runId: "generated-source-receipt-v2-run",
    originClaimId: 71,
    ownerClaimId: 72,
    passKind: "design_source_generation",
    authorityHash: sha256("receipt-authority"),
    requestHash: sha256("receipt-request"),
    ordinal: 1,
    retryAuthority: null,
    generation: 1,
    fenceToken: sha256("receipt-fence"),
    state: "sealed",
    disposition: "accepted",
    lease: null,
    dispatch: {
      intentCommittedAt: "2026-07-18T05:00:00.000Z",
      startedAt: "2026-07-18T05:00:01.000Z",
      finishedAt: "2026-07-18T05:00:02.000Z",
      externalOperationId: "stitch-generated-source-receipt-v2",
    },
    outputRefs,
    outputSealHash,
    failure: null,
    attemptLocator: ".setfarm/product-compilation-attempts/generated-source-receipt-v2",
    createdAt: "2026-07-18T05:00:00.000Z",
    updatedAt: "2026-07-18T05:00:02.000Z",
  });
}

async function validInput(): Promise<any> {
  const fixture = await buildStitchProductBuildPacketV3Contracts(producer);
  const sources = fixture.implementationSourceInputsV1 as any;
  const artifacts = fixture.designSourceArtifactsV2 as any;
  const generationTargets = semanticArtifact(
    "setfarm.design-generation-targets.v2",
    artifacts.generationTargets,
  );
  const directResponseEvidence = semanticArtifact(
    "setfarm.stitch-direct-response-evidence.v2",
    artifacts.directResponseEvidence,
  );
  const renderedSemantics = semanticArtifact(
    "setfarm.stitch-rendered-semantics.v2",
    artifacts.renderedSemantics,
  );
  const candidateSelection = semanticArtifact(
    "setfarm.stitch-target-candidate-selection.v2",
    artifacts.candidateSelection,
  );
  const responseBindings = semanticArtifact(
    "setfarm.stitch-target-response-bindings.v3",
    artifacts.responseBindings,
  );
  const designGraph = semanticArtifact(
    "setfarm.design-interaction-graph.v2",
    fixture.designGraphV2,
  );
  const outputRefs = {
    directResponseEvidenceHash: directResponseEvidence.reference.payloadHash,
    renderedSemanticsHash: renderedSemantics.reference.payloadHash,
    candidateSelectionHash: candidateSelection.reference.payloadHash,
    responseBindingsHash: responseBindings.reference.payloadHash,
  };
  const attempt = acceptedAttempt(outputRefs);
  const outputArtifacts = [
    ["directResponseEvidenceHash", directResponseEvidence, "direct-response-evidence.json"],
    ["renderedSemanticsHash", renderedSemantics, "rendered-semantics.json"],
    ["candidateSelectionHash", candidateSelection, "candidate-selection.json"],
    ["responseBindingsHash", responseBindings, "response-bindings.json"],
  ] as const;
  const artifactManifest = createProductCompilationArtifactManifestV1({
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
  const receiptArtifacts = artifactManifest.projectionArtifacts
    .map((artifact) => ({
      path: artifact.targetPath,
      contentHash: artifact.source.contentHash,
      byteLength: artifact.source.byteLength,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const projectionPayload = {
    schema: "setfarm.product-compilation-projection-receipt.v1" as const,
    attemptId: attempt.attemptId,
    outputSealHash: attempt.outputSealHash,
    manifestHash: artifactManifest.manifestHash,
    projectionHash: hashCanonicalJson({
      schema: "setfarm.product-compilation-projection-content.v1",
      attemptId: attempt.attemptId,
      artifacts: receiptArtifacts,
    }),
    artifacts: receiptArtifacts,
  };
  const projectionReceipt = ProductCompilationProjectionReceiptV1Schema.parse({
    ...projectionPayload,
    receiptHash: hashCanonicalJson(projectionPayload),
  });
  return {
    producer,
    releaseAuthority: {
      schema: "setfarm.generated-source-release-authority.v2",
      codeSha: producer.codeSha,
      generatorPlatformBundleHash: sha256("generated-source-platform-bundle-v2"),
    },
    productSpec: fixture.productSpecV2,
    designSourceClosureInput: {
      kind: "stitch",
      productSpecV2Hash: hashCanonicalJson(fixture.productSpecV2),
      generationTargets,
      directResponseEvidence,
      renderedSemantics,
      candidateSelection,
      responseBindings,
      designGraph,
      acceptedAttempt: attempt,
      artifactManifest,
      projectionReceipt,
    },
    generatorImplementationSource: {
      source: sources.converterSource.source,
      bytes: Buffer.from(sources.converterSource.text, "utf8"),
    },
    screenIndexSource: {
      source: sources.screenIndexSource.source,
      bytes: Buffer.from(sources.screenIndexSource.text, "utf8"),
    },
    generatedSources: sources.generatedSources.map((source: any) => ({
      targetRef: source.targetRef,
      responseScreenId: source.responseScreenId,
      source: source.source,
      bytes: Buffer.from(source.text, "utf8"),
    })),
  };
}

function candidatePublications(compiled: Extract<
  ReturnType<typeof compileGeneratedSourceReceiptsV2>,
  { status: "compiled" }
>) {
  return compiled.publications.map((publication) => ({
    targetRef: publication.targetRef,
    envelopes: publication.publicationEnvelopes.map((envelope) => structuredClone(envelope)),
  }));
}

function resealSource(source: { source: { hash: string; byteLength: number }; bytes: Uint8Array }): void {
  source.source.hash = sha256(source.bytes);
  source.source.byteLength = source.bytes.byteLength;
}

function resealReceipt(receipt: any): void {
  const authority = generatedSourceReceiptEntryAuthorityV2(receipt);
  receipt.entryCommitmentHash = hashGeneratedSourceReceiptEntryCommitmentV2(authority);
  receipt.receiptRef = generatedSourceReceiptRefV2(receipt.entryCommitmentHash);
  const entry = receipt.receiptSet.entries.find((candidate: any) =>
    candidate.targetRef === receipt.targetRef)!;
  entry.entryCommitmentHash = receipt.entryCommitmentHash;
  receipt.receiptSet.commitmentHash = hashGeneratedSourceReceiptSetCommitmentV2(
    receipt.receiptSet.entries,
  );
}

function rejectionCodes(result: ReturnType<typeof compileGeneratedSourceReceiptsV2>): string[] {
  assert.equal(result.status, "rejected", JSON.stringify(result));
  return result.status === "rejected" ? result.diagnostics.map((item) => item.code) : [];
}

let input: any;

before(async () => {
  input = await validInput();
});

describe("GeneratedSourceReceiptV2", { concurrency: 1 }, () => {
  it("compiles one exact byte/semantic receipt with full refs, element bindings, and an atomic batch", () => {
    const originalSource = Buffer.from(input.generatedSources[0].bytes);
    const compiled = compileGeneratedSourceReceiptsV2(input);
    assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
    if (compiled.status !== "compiled") return;
    assert.equal(compiled.publications.length, 1);
    const publication = compiled.publications[0]!;
    const receipt = publication.receipt;
    assert.match(receipt.receiptRef, /^GSRC_[a-f0-9]{64}$/);
    assert.equal(receipt.generatedSourceContentHash, sha256(originalSource));
    assert.equal(receipt.generatedSourceArtifactHash, publication.generatedSourceBundleArtifactHash);
    assert.equal(receipt.receiptSet.entries[0]?.targetRef, receipt.targetRef);
    assert.equal(receipt.generatorExecution.status, "unverified");
    assert.equal(
      receipt.generatorExecution.blockerCode,
      "SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED",
    );
    const elementKeys = receipt.semanticIdentityClosure.generatedElementBindings.map((binding) =>
      `${binding.kind}\0${binding.subjectRef}`);
    assert.deepEqual(elementKeys, [...elementKeys].sort());
    assert.equal(
      elementKeys.length,
      receipt.semanticIdentityClosure.surfaceRefs.length
        + receipt.semanticIdentityClosure.physicalControlRefs.length,
    );
    assert.ok(publication.preparedPublication.occurrenceCount >= 3);
    assert.ok(publication.preparedPublication.occurrenceCount <= 9);
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(Object.isFrozen(receipt.semanticIdentityClosure.generatedElementBindings), true);
    assert.deepEqual(Buffer.from(input.generatedSources[0].bytes), originalSource);
  });

  it("is deterministic, does not retain caller bytes, and fresh-verifies exact candidate artifacts", () => {
    const firstInput = structuredClone(input);
    const first = compileGeneratedSourceReceiptsV2(firstInput);
    const second = compileGeneratedSourceReceiptsV2(structuredClone(input));
    assert.equal(first.status, "compiled", JSON.stringify(first));
    assert.equal(second.status, "compiled", JSON.stringify(second));
    if (first.status !== "compiled" || second.status !== "compiled") return;
    assert.equal(first.publications[0]!.receiptArtifactHash, second.publications[0]!.receiptArtifactHash);
    assert.equal(
      canonicalJsonBytes(first.publications[0]!.receiptEnvelope).toString("hex"),
      canonicalJsonBytes(second.publications[0]!.receiptEnvelope).toString("hex"),
    );
    const before = first.publications[0]!.receipt.generatedSourceContentHash;
    firstInput.generatedSources[0].bytes[0] ^= 0xff;
    assert.equal(first.publications[0]!.receipt.generatedSourceContentHash, before);
    const verified = verifyGeneratedSourceReceiptsV2({
      compilerInput: input,
      candidatePublications: candidatePublications(first),
    });
    assert.equal(verified.status, "verified", JSON.stringify(verified));
  });

  it("rejects a schema-valid self-consistent candidate receipt forged against fresh authority", () => {
    const compiled = compileGeneratedSourceReceiptsV2(input);
    assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
    if (compiled.status !== "compiled") return;
    const candidates = candidatePublications(compiled);
    const receiptEnvelope = candidates[0]!.envelopes.find((envelope: any) =>
      envelope.artifactType === "setfarm.generated-source-receipt.v2") as any;
    receiptEnvelope.payload.generatorPlatformBundleHash = sha256("forged-platform-bundle");
    resealReceipt(receiptEnvelope.payload);
    const result = verifyGeneratedSourceReceiptsV2({
      compilerInput: input,
      candidatePublications: candidates,
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.ok(result.diagnostics.some((item) =>
        item.code === "GENERATED_SOURCE_RECEIPT_V2_CANDIDATE_MISMATCH"));
    }
  });

  it("rejects receipt-only, missing-byte, duplicate-artifact, and cross-target candidate groups", () => {
    const compiled = compileGeneratedSourceReceiptsV2(input);
    assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
    if (compiled.status !== "compiled") return;
    const exact = candidatePublications(compiled);
    const receiptOnly = structuredClone(exact);
    receiptOnly[0]!.envelopes = receiptOnly[0]!.envelopes.filter((envelope: any) =>
      envelope.artifactType === "setfarm.generated-source-receipt.v2");
    assert.equal(verifyGeneratedSourceReceiptsV2({
      compilerInput: input,
      candidatePublications: receiptOnly,
    }).status, "rejected");

    const missingChunk = structuredClone(exact);
    const chunkIndex = missingChunk[0]!.envelopes.findIndex((envelope: any) =>
      envelope.artifactType === "setfarm.byte-chunk.v1");
    missingChunk[0]!.envelopes.splice(chunkIndex, 1);
    assert.equal(verifyGeneratedSourceReceiptsV2({
      compilerInput: input,
      candidatePublications: missingChunk,
    }).status, "rejected");

    const duplicate = structuredClone(exact);
    duplicate[0]!.envelopes.push(structuredClone(duplicate[0]!.envelopes[0]));
    assert.equal(verifyGeneratedSourceReceiptsV2({
      compilerInput: input,
      candidatePublications: duplicate,
    }).status, "rejected");

    const wrongTarget = structuredClone(exact);
    wrongTarget[0]!.targetRef = "GT_FORGED";
    assert.equal(verifyGeneratedSourceReceiptsV2({
      compilerInput: input,
      candidatePublications: wrongTarget,
    }).status, "rejected");
  });

  it("rejects stale raw refs and self-consistent malformed UTF-8", () => {
    const stale = structuredClone(input);
    stale.generatedSources[0].bytes[0] ^= 0x01;
    assert.ok(rejectionCodes(compileGeneratedSourceReceiptsV2(stale)).includes(
      "GENERATED_SOURCE_RECEIPT_V2_AUTHORITY_MISMATCH",
    ));

    const malformed = structuredClone(input);
    malformed.generatedSources[0].bytes = Uint8Array.from([0xc3, 0x28]);
    resealSource(malformed.generatedSources[0]);
    assert.ok(rejectionCodes(compileGeneratedSourceReceiptsV2(malformed)).includes(
      "GENERATED_SOURCE_RECEIPT_V2_AUTHORITY_MISMATCH",
    ));
  });

  it("rejects a strict self-consistent index that substitutes graph physical identity", () => {
    const forged = structuredClone(input);
    const index = JSON.parse(Buffer.from(forged.screenIndexSource.bytes).toString("utf8"));
    const physical = index[0].controls.find((control: any) => control.semanticSource === "data-action");
    physical.physicalControlRef = "CTRL_FORGED";
    const action = index[0].actions.find((candidate: any) =>
      candidate.generatedLocalId === physical.generatedLocalId);
    action.physicalControlRef = "CTRL_FORGED";
    forged.screenIndexSource.bytes = Buffer.from(JSON.stringify(index, null, 2), "utf8");
    resealSource(forged.screenIndexSource);
    const result = compileGeneratedSourceReceiptsV2(forged);
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.ok(result.diagnostics.some((item) =>
        item.message.includes("physical control")));
    }
  });

  it("rejects closure, converter, and release drift against exact prior candidates", () => {
    const compiled = compileGeneratedSourceReceiptsV2(input);
    assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
    if (compiled.status !== "compiled") return;
    const candidates = candidatePublications(compiled);

    const closureDrift = structuredClone(input);
    closureDrift.designSourceClosureInput.designGraph.reference.payloadHash = sha256("stale-graph");
    assert.equal(compileGeneratedSourceReceiptsV2(closureDrift).status, "rejected");

    const converterDrift = structuredClone(input);
    converterDrift.generatorImplementationSource.bytes = Buffer.concat([
      Buffer.from(converterDrift.generatorImplementationSource.bytes),
      Buffer.from("// drift\n"),
    ]);
    resealSource(converterDrift.generatorImplementationSource);
    assert.equal(verifyGeneratedSourceReceiptsV2({
      compilerInput: converterDrift,
      candidatePublications: candidates,
    }).status, "rejected");

    const releaseDrift = structuredClone(input);
    releaseDrift.releaseAuthority.generatorPlatformBundleHash = sha256("release-drift");
    assert.equal(verifyGeneratedSourceReceiptsV2({
      compilerInput: releaseDrift,
      candidatePublications: candidates,
    }).status, "rejected");
  });

  it("rejects duplicate/missing target maps without path or title fallback", () => {
    const missing = structuredClone(input);
    missing.generatedSources = [];
    assert.equal(compileGeneratedSourceReceiptsV2(missing).status, "rejected");

    const duplicate = structuredClone(input);
    duplicate.generatedSources.push(structuredClone(duplicate.generatedSources[0]));
    assert.equal(compileGeneratedSourceReceiptsV2(duplicate).status, "rejected");

    const guessedPath = structuredClone(input);
    guessedPath.generatedSources[0].source.locator = "src/screens/guessed.tsx";
    assert.equal(compileGeneratedSourceReceiptsV2(guessedPath).status, "rejected");
  });

  it("rejects receipt surface and physical bindings absent from or ambiguous in exact generated TSX", () => {
    const surface = input.designSourceClosureInput.designGraph.envelope.payload.surfaces[0];
    const exactAttribute = `data-surface-id=${JSON.stringify(surface.surfaceRef)}`;
    assert.ok(Buffer.from(input.generatedSources[0].bytes).toString("utf8").includes(exactAttribute));

    const missing = structuredClone(input);
    missing.generatedSources[0].bytes = Buffer.from(
      Buffer.from(missing.generatedSources[0].bytes).toString("utf8").replace(
        exactAttribute,
        `data-unbound-surface-id=${JSON.stringify(surface.surfaceRef)}`,
      ),
      "utf8",
    );
    resealSource(missing.generatedSources[0]);
    assert.ok(rejectionCodes(compileGeneratedSourceReceiptsV2(missing)).includes(
      "GENERATED_SOURCE_RECEIPT_V2_SOURCE_INVALID",
    ));

    const ambiguous = structuredClone(input);
    const duplicate = `<section ${exactAttribute} data-setfarm-element-ref=${JSON.stringify(surface.elementRef)}>Duplicate</section>`;
    ambiguous.generatedSources[0].bytes = Buffer.from(
      Buffer.from(ambiguous.generatedSources[0].bytes).toString("utf8").replace(
        "    </main>",
        `      ${duplicate}\n    </main>`,
      ),
      "utf8",
    );
    resealSource(ambiguous.generatedSources[0]);
    assert.ok(rejectionCodes(compileGeneratedSourceReceiptsV2(ambiguous)).includes(
      "GENERATED_SOURCE_RECEIPT_V2_SOURCE_INVALID",
    ));

    const physical = input.designSourceClosureInput.designGraph.envelope.payload.controls[0];
    const duplicatedPhysicalElement = structuredClone(input);
    duplicatedPhysicalElement.generatedSources[0].bytes = Buffer.from(
      Buffer.from(duplicatedPhysicalElement.generatedSources[0].bytes).toString("utf8").replace(
        "    </main>",
        `      <span data-setfarm-element-ref=${JSON.stringify(physical.elementRef)}>Duplicate physical locator</span>\n    </main>`,
      ),
      "utf8",
    );
    resealSource(duplicatedPhysicalElement.generatedSources[0]);
    assert.ok(rejectionCodes(compileGeneratedSourceReceiptsV2(duplicatedPhysicalElement)).includes(
      "GENERATED_SOURCE_RECEIPT_V2_SOURCE_INVALID",
    ));
  });

  it("preserves duplicate CAS chunk occurrences so compiler output always fresh-verifies", () => {
    const repeated = structuredClone(input);
    const padding = Buffer.from(`\n/*${"a".repeat((6 * 1024 * 1024) + 128)}*/\n`, "utf8");
    repeated.generatedSources[0].bytes = Buffer.concat([
      Buffer.from(repeated.generatedSources[0].bytes),
      padding,
    ]);
    resealSource(repeated.generatedSources[0]);
    const compiled = compileGeneratedSourceReceiptsV2(repeated);
    assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
    if (compiled.status !== "compiled") return;
    const chunkHashes = compiled.publications[0]!.publicationEnvelopes
      .filter((envelope) => envelope.artifactType === "setfarm.byte-chunk.v1")
      .map((envelope) => hashCanonicalJson(envelope));
    assert.ok(chunkHashes.length > new Set(chunkHashes).size);
    assert.equal(verifyGeneratedSourceReceiptsV2({
      compilerInput: repeated,
      candidatePublications: candidatePublications(compiled),
    }).status, "verified");

    const redistributed = candidatePublications(compiled);
    const chunkOccurrences = redistributed[0]!.envelopes
      .map((envelope: any, index: number) => ({ envelope, index }))
      .filter(({ envelope }: any) => envelope.artifactType === "setfarm.byte-chunk.v1")
      .map(({ envelope, index }: any) => ({
        index,
        hash: hashCanonicalJson(envelope),
      }));
    const duplicateHash = chunkOccurrences.find((item, index, all) =>
      all.some((other, otherIndex) => otherIndex !== index && other.hash === item.hash))!.hash;
    const duplicateOccurrence = chunkOccurrences.find((item) => item.hash === duplicateHash)!;
    const otherOccurrence = chunkOccurrences.find((item) => item.hash !== duplicateHash)!;
    redistributed[0]!.envelopes[duplicateOccurrence.index] = structuredClone(
      redistributed[0]!.envelopes[otherOccurrence.index],
    );
    assert.equal(verifyGeneratedSourceReceiptsV2({
      compilerInput: repeated,
      candidatePublications: redistributed,
    }).status, "rejected");
  });

  it("rejects proxies, accessors, cycles, sparse arrays, and oversized raw sources without traps", () => {
    let proxyTouched = false;
    const hostileProxy = new Proxy(input, {
      get() {
        proxyTouched = true;
        throw new Error("proxy trap must not run");
      },
    });
    assert.equal(compileGeneratedSourceReceiptsV2(hostileProxy).status, "rejected");
    assert.equal(proxyTouched, false);

    let accessorTouched = false;
    const accessor = structuredClone(input);
    Object.defineProperty(accessor, "producer", {
      enumerable: true,
      get() {
        accessorTouched = true;
        throw new Error("accessor must not run");
      },
    });
    assert.equal(compileGeneratedSourceReceiptsV2(accessor).status, "rejected");
    assert.equal(accessorTouched, false);

    const cyclic = structuredClone(input);
    cyclic.productSpec.cycle = cyclic.productSpec;
    assert.equal(compileGeneratedSourceReceiptsV2(cyclic).status, "rejected");

    const sparse = structuredClone(input);
    sparse.generatedSources = new Array(1);
    assert.equal(compileGeneratedSourceReceiptsV2(sparse).status, "rejected");

    const oversized = structuredClone(input);
    oversized.generatedSources[0].bytes = Buffer.alloc((14 * 1024 * 1024) + 1, 0x20);
    resealSource(oversized.generatedSources[0]);
    assert.equal(compileGeneratedSourceReceiptsV2(oversized).status, "rejected");

    for (const property of ["buffer", "byteLength"] as const) {
      let typedArrayAccessorTouched = false;
      const hostile = structuredClone(input);
      const bytes = new Uint8Array(hostile.generatedSources[0].bytes);
      Object.defineProperty(bytes, property, {
        configurable: true,
        get() {
          typedArrayAccessorTouched = true;
          throw new Error(`typed-array ${property} accessor must not run`);
        },
      });
      hostile.generatedSources[0].bytes = bytes;
      assert.equal(compileGeneratedSourceReceiptsV2(hostile).status, "rejected");
      assert.equal(typedArrayAccessorTouched, false);
    }

    class HostileBytes extends Uint8Array {}
    const subclassed = structuredClone(input);
    subclassed.generatedSources[0].bytes = new HostileBytes(
      subclassed.generatedSources[0].bytes,
    );
    assert.equal(compileGeneratedSourceReceiptsV2(subclassed).status, "rejected");

    if (typeof SharedArrayBuffer !== "undefined") {
      const shared = structuredClone(input);
      const source = new Uint8Array(shared.generatedSources[0].bytes);
      const sharedBytes = new Uint8Array(new SharedArrayBuffer(source.byteLength));
      sharedBytes.set(source);
      shared.generatedSources[0].bytes = sharedBytes;
      assert.equal(compileGeneratedSourceReceiptsV2(shared).status, "rejected");

      const crossRealmShared = structuredClone(input);
      const crossRealmSource = new Uint8Array(crossRealmShared.generatedSources[0].bytes);
      const context = createContext({ sourceByteLength: crossRealmSource.byteLength });
      const launderedSharedBytes = runInContext(
        "new Uint8Array(new SharedArrayBuffer(sourceByteLength))",
        context,
      ) as Uint8Array;
      Object.setPrototypeOf(launderedSharedBytes, Uint8Array.prototype);
      Uint8Array.prototype.set.call(launderedSharedBytes, crossRealmSource);
      crossRealmShared.generatedSources[0].bytes = launderedSharedBytes;
      assert.equal(compileGeneratedSourceReceiptsV2(crossRealmShared).status, "rejected");
    }
  });
});
