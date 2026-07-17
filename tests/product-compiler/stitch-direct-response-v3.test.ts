import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { canonicalDesignSourceGenerationPromptV2 } from "../../src/product-compiler/design-source-compilation-attempt-runner.js";
import { produceDesignGenerationTargetsV3 } from "../../src/product-compiler/producers/design-targets-v3.js";
import {
  produceDesignSourceGenerationDispatchReceiptV3,
  produceDesignSourceGenerationRequestV3,
  produceStitchDirectResponseEvidenceV3,
  verifyStitchDirectResponseEvidenceV3,
} from "../../src/product-compiler/producers/stitch-direct-response-v3.js";
import {
  DesignSourceGenerationDispatchReceiptV3Schema,
  DesignSourceGenerationRequestV3Schema,
  designSourceGenerationRequestRefV3,
  hashDesignSourceGenerationDispatchReceiptV3,
  hashDesignSourceGenerationAuthorityBindingV3,
  hashDesignSourceGenerationRequestReceiptV3,
  type DesignSourceGenerationDispatchReceiptV3,
  type DesignSourceGenerationRequestV3,
} from "../../src/product-compiler/schemas/design-source-generation-request-v3.js";
import {
  DesignGenerationTargetsV3Schema,
  hashDesignGenerationTargetV3,
  hashDesignGenerationTargetsV3,
  type DesignGenerationTargetsV3,
} from "../../src/product-compiler/schemas/design-generation-targets-v3.js";
import type { DesignSourceGenerationAuthorityV1 } from "../../src/product-compiler/schemas/design-source-generation-authority-v1.js";
import {
  StitchDirectResponseEvidenceV3Schema,
  hashStitchDirectResponseEvidenceV3,
  hashStitchDirectResponseOperationV3,
  hashStitchDirectScreenEvidenceV3,
  stitchDirectScreenSourceEvidenceHashV3,
  type StitchDirectProviderResponseV3,
  type StitchDirectResponseEvidenceV3,
} from "../../src/product-compiler/schemas/stitch-direct-response-evidence-v3.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import { buildContainedGameProductSpecV2 } from "./fixtures/product-semantics-v2.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const productSpecByTargets = new WeakMap<DesignGenerationTargetsV3, ProductSpecV2>();
const authorityByHash = new Map<string, DesignSourceGenerationAuthorityV1>();

function producedTargets(productSpec = buildContainedGameProductSpecV2()): DesignGenerationTargetsV3 {
  const parsedProductSpec = ProductSpecV2Schema.parse(productSpec);
  const result = produceDesignGenerationTargetsV3(parsedProductSpec);
  assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
  if (result.status !== "produced") throw new Error("Expected generation targets");
  productSpecByTargets.set(result.generationTargets, parsedProductSpec);
  return result.generationTargets;
}

function sourceProductSpec(generationTargets: DesignGenerationTargetsV3): ProductSpecV2 {
  const productSpec = productSpecByTargets.get(generationTargets);
  if (!productSpec) throw new Error("Missing exact ProductSpec fixture authority");
  return productSpec;
}

function generationAuthorityFor(
  generationTargets: DesignGenerationTargetsV3,
): DesignSourceGenerationAuthorityV1 {
  const authority: DesignSourceGenerationAuthorityV1 = {
    schema: "setfarm.design-source-generation-authority.v1",
    runId: "run-stitch-direct-response-v3",
    originClaimId: 1,
    productSpecHash: hashCanonicalJson(sourceProductSpec(generationTargets)),
    generationTargetsHash: hashCanonicalJson(generationTargets),
    promptContractHash: "5".repeat(64),
    renderPolicyHash: "6".repeat(64),
    selectionPolicyHash: "7".repeat(64),
    producerReleaseSha: "8".repeat(40),
    provider: "stitch",
    model: "stitch-v3",
    deviceType: "DESKTOP",
    targetRefs: generationTargets.targets.map((target) => target.targetId).sort(),
    maximumAttempts: 2,
  };
  authorityByHash.set(hashDesignSourceGenerationAuthorityBindingV3(authority), authority);
  return authority;
}

function sourceAuthorityInput(generationTargets: DesignGenerationTargetsV3) {
  return {
    productSpec: sourceProductSpec(generationTargets),
    generationTargets,
    generationAuthority: generationAuthorityFor(generationTargets),
  };
}

function produceEvidence(
  generationTargets: DesignGenerationTargetsV3,
  input: Omit<Parameters<typeof produceStitchDirectResponseEvidenceV3>[0],
  "productSpec" | "generationTargets" | "generationAuthority">,
) {
  return produceStitchDirectResponseEvidenceV3({
    ...sourceAuthorityInput(generationTargets),
    ...input,
  });
}

function verifyEvidence(
  generationTargets: DesignGenerationTargetsV3,
  input: Omit<Parameters<typeof verifyStitchDirectResponseEvidenceV3>[0],
  "productSpec" | "generationTargets" | "generationAuthority">,
) {
  return verifyStitchDirectResponseEvidenceV3({
    ...sourceAuthorityInput(generationTargets),
    ...input,
  });
}

function duplicateTitleTargets(): DesignGenerationTargetsV3 {
  const productSpec: any = clone(buildContainedGameProductSpecV2());
  const requirementRefs = productSpec.requirements.map((requirement: any) => requirement.id);
  const root = productSpec.surfaces.find((surface: any) =>
    surface.composition.kind === "route_root")!;
  productSpec.routes.push({
    id: "ROUTE_SECOND_PLAY",
    path: "/second-play",
    rootSurfaceRef: "SURF_SECOND_PLAY_PAGE",
    surfaceRefs: ["SURF_SECOND_PLAY_PAGE"],
    entry: false,
  });
  productSpec.surfaces.push({
    id: "SURF_SECOND_PLAY_PAGE",
    name: root.name,
    kind: "page",
    routeRef: "ROUTE_SECOND_PLAY",
    required: true,
    composition: { kind: "route_root" },
  });
  productSpec.traceability.bindings.push(
    { semanticKind: "route", semanticRef: "ROUTE_SECOND_PLAY", requirementRefs },
    { semanticKind: "surface", semanticRef: "SURF_SECOND_PLAY_PAGE", requirementRefs },
  );
  return producedTargets(ProductSpecV2Schema.parse(productSpec));
}

function requestFor(
  generationTargets: DesignGenerationTargetsV3,
  targetRef: string,
): DesignSourceGenerationRequestV3 {
  const result = produceDesignSourceGenerationRequestV3({
    ...sourceAuthorityInput(generationTargets),
    targetRefs: [targetRef],
    ordinal: 1,
    retryAuthority: null,
    prompt: `Generate exact target ${targetRef}.\r\n`,
  });
  assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
  if (result.status !== "produced") throw new Error("Expected request receipt");
  return result.request;
}

function dispatchFor(
  request: DesignSourceGenerationRequestV3,
  index: number,
): DesignSourceGenerationDispatchReceiptV3 {
  const generationAuthority = authorityByHash.get(request.generationAuthorityHash);
  if (!generationAuthority) throw new Error("Missing request generation authority fixture");
  const result = produceDesignSourceGenerationDispatchReceiptV3({
    request,
    dispatchedGenerationAuthority: generationAuthority,
    externalOperationId: `provider-secret-operation-${index}`,
  });
  assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
  if (result.status !== "produced") throw new Error("Expected dispatch receipt");
  return result.dispatchReceipt;
}

function providerResponse(
  screenId: string,
  title: string,
  options: Readonly<{
    screenshotAvailable?: boolean;
    screenshotDownloaded?: boolean;
  }> = {},
): StitchDirectProviderResponseV3 {
  const screenshotAvailable = options.screenshotAvailable ?? true;
  const screenshotDownloaded = options.screenshotDownloaded
    ?? screenshotAvailable;
  return {
    schema: "setfarm.stitch-direct-provider-response.v3",
    screens: [{
      screenId,
      title,
      responsePaths: [`$result.screens.${screenId}`],
      htmlAvailable: true,
      screenshotAvailable,
      htmlSourceRefHash: "1".repeat(64),
      screenshotSourceRefHash: screenshotAvailable ? "2".repeat(64) : null,
      htmlDownloadedArtifactHash: "3".repeat(64),
      screenshotDownloadedArtifactHash: screenshotDownloaded ? "4".repeat(64) : null,
    }],
  };
}

function boundResponse(
  requestRef: string,
  response: StitchDirectProviderResponseV3,
  transportSeed = requestRef,
) {
  return {
    requestRef,
    rawTransportArtifactHash: hashCanonicalJson({
      schema: "test.stitch-raw-transport-artifact.v1",
      transportSeed,
    }),
    response,
  };
}

function requestSet(generationTargets: DesignGenerationTargetsV3) {
  const requests = generationTargets.targets.map((target) =>
    requestFor(generationTargets, target.targetId));
  const dispatchReceipts = requests.map((request, index) => dispatchFor(request, index + 1));
  const rawResponses = requests.map((request, index) => boundResponse(
    request.requestRef,
    providerResponse(
      `screen-v3-${index + 1}`,
      generationTargets.targets[index]!.expectedScreenTitle,
    ),
  ));
  return { requests, dispatchReceipts, rawResponses };
}

function rehashRequest(request: DesignSourceGenerationRequestV3): void {
  const { requestRef: _requestRef, receiptHash: _receiptHash, ...core } = request;
  request.requestRef = designSourceGenerationRequestRefV3(core);
  const { receiptHash: _hash, ...payload } = request;
  request.receiptHash = hashDesignSourceGenerationRequestReceiptV3(payload);
}

function rehashDispatch(receipt: DesignSourceGenerationDispatchReceiptV3): void {
  const { dispatchReceiptHash: _dispatchReceiptHash, ...payload } = receipt;
  receipt.dispatchReceiptHash = hashDesignSourceGenerationDispatchReceiptV3(payload);
}

function rehashEvidence(evidence: StitchDirectResponseEvidenceV3): void {
  for (const operation of evidence.operations) {
    for (const candidate of operation.candidates) {
      candidate.sourceEvidenceHash = stitchDirectScreenSourceEvidenceHashV3(candidate);
      const { candidateHash: _candidateHash, ...candidatePayload } = candidate;
      candidate.candidateHash = hashStitchDirectScreenEvidenceV3(candidatePayload);
    }
    operation.candidatesHash = hashCanonicalJson(operation.candidates);
    const { operationHash: _operationHash, ...operationPayload } = operation;
    operation.operationHash = hashStitchDirectResponseOperationV3(operationPayload);
  }
  evidence.requestsHash = hashCanonicalJson(
    evidence.operations.map((operation) => operation.request),
  );
  evidence.dispatchReceiptsHash = hashCanonicalJson(
    evidence.operations.map((operation) => operation.dispatchReceipt),
  );
  evidence.operationsHash = hashCanonicalJson(evidence.operations);
  const { payloadHash: _payloadHash, ...payload } = evidence;
  evidence.payloadHash = hashStitchDirectResponseEvidenceV3(payload);
}

describe("Stitch direct response identity v3", () => {
  it("separates deterministic request authority from post-dispatch opaque identity", () => {
    const generationTargets = producedTargets();
    const targetRef = generationTargets.targets[0]!.targetId;
    const first = requestFor(generationTargets, targetRef);
    const secondResult = produceDesignSourceGenerationRequestV3({
      ...sourceAuthorityInput(generationTargets),
      targetRefs: [targetRef],
      ordinal: 1,
      retryAuthority: null,
      prompt: `Generate exact target ${targetRef}.\n\n`,
    });
    assert.equal(secondResult.status, "produced", JSON.stringify(secondResult.diagnostics));
    if (secondResult.status !== "produced") return;
    assert.deepEqual(secondResult.request, first, "CRLF and terminal blank lines canonicalize");
    assert.equal(
      first.promptHash,
      canonicalDesignSourceGenerationPromptV2(
        `Generate exact target ${targetRef}.\r\n`,
      ).promptHash,
    );
    assert.match(first.requestRef, /^DSREQ_[A-F0-9]{64}$/);
    assert.equal(DesignSourceGenerationRequestV3Schema.safeParse(first).success, true);
    assert.equal("externalOperationIdHash" in first, false);

    const dispatch = dispatchFor(first, 1);
    assert.equal(DesignSourceGenerationDispatchReceiptV3Schema.safeParse(dispatch).success, true);
    assert.equal("externalOperationId" in dispatch, false);
    assert.equal(JSON.stringify(dispatch).includes("provider-secret-operation-1"), false);

    const largerTargets = duplicateTitleTargets();
    const sameRootRequest = requestFor(
      largerTargets,
      largerTargets.targets.find((target) => target.targetId === targetRef)!.targetId,
    );
    assert.equal(
      JSON.stringify(sameRootRequest).length,
      JSON.stringify(first).length,
      "request size must not grow with parent authority targetRefs",
    );
    assert.equal("generationAuthority" in first, false);
  });

  it("rejects multi-target provider operations before a request receipt exists", () => {
    const generationTargets = duplicateTitleTargets();
    const result = produceDesignSourceGenerationRequestV3({
      ...sourceAuthorityInput(generationTargets),
      targetRefs: generationTargets.targets.map((target) => target.targetId),
      ordinal: 1,
      retryAuthority: null,
      prompt: "Generate both targets",
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(result.rejectionCodes, ["DESIGN_REQUEST_V3_TARGET_CARDINALITY_INVALID"]);

    const retry = produceDesignSourceGenerationRequestV3({
      ...sourceAuthorityInput(generationTargets),
      targetRefs: [generationTargets.targets[0]!.targetId],
      ordinal: 2,
      retryAuthority: {
        parentAttemptRef: `PCA_${"a".repeat(64)}`,
        parentFailureArtifactHash: "b".repeat(64),
        parentFailureFingerprint: "c".repeat(64),
        retryDeltaHash: "d".repeat(64),
      },
      prompt: "Retry one target",
    });
    assert.equal(retry.status, "rejected");
    if (retry.status === "rejected") {
      assert.deepEqual(retry.rejectionCodes, ["DESIGN_REQUEST_V3_RETRY_NOT_SUPPORTED"]);
    }
  });

  it("inherits target identity from request and preserves a mismatched provider title as data", () => {
    const generationTargets = producedTargets();
    const { requests, dispatchReceipts } = requestSet(generationTargets);
    const rawResponses = [boundResponse(
      requests[0]!.requestRef,
      providerResponse("screen-title-mismatch", "Provider changed this title"),
    )];
    const result = produceEvidence(generationTargets, {
      requests,
      dispatchReceipts,
      rawResponses,
    });
    assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
    if (result.status !== "produced") return;
    const candidate = result.directResponseEvidence.operations[0]!.candidates[0]!;
    assert.equal(candidate.title, "Provider changed this title");
    assert.equal(candidate.targetRef, requests[0]!.targetRef);
    assert.equal(candidate.targetHash, requests[0]!.targetHash);
    assert.equal(candidate.requestScreenKey, requests[0]!.requestScreenKey);
    assert.equal(candidate.requestReceiptHash, requests[0]!.receiptHash);
    assert.equal(candidate.dispatchReceiptHash, dispatchReceipts[0]!.dispatchReceiptHash);
  });

  it("accepts duplicate human titles across exact target-scoped requests deterministically", () => {
    const generationTargets = duplicateTitleTargets();
    assert.equal(new Set(
      generationTargets.targets.map((target) => target.expectedScreenTitle),
    ).size, 1);
    const input = requestSet(generationTargets);
    const forward = produceEvidence(generationTargets, {
      ...input,
    });
    const reversed = produceEvidence(generationTargets, {
      requests: [...input.requests].reverse(),
      dispatchReceipts: [...input.dispatchReceipts].reverse(),
      rawResponses: [...input.rawResponses].reverse(),
    });
    assert.equal(forward.status, "produced", JSON.stringify(forward.diagnostics));
    assert.equal(reversed.status, "produced", JSON.stringify(reversed.diagnostics));
    if (forward.status !== "produced" || reversed.status !== "produced") return;
    assert.deepEqual(reversed.directResponseEvidence, forward.directResponseEvidence);
    const candidates = forward.directResponseEvidence.operations.map((operation) =>
      operation.candidates[0]!);
    assert.equal(new Set(candidates.map((candidate) => candidate.title)).size, 1);
    assert.equal(new Set(candidates.map((candidate) => candidate.targetRef)).size, 2);
    assert.equal(new Set(candidates.map((candidate) => candidate.requestScreenKey)).size, 2);
  });

  it("derives missing-evidence disposition and rejects provider-authored identity fields", () => {
    const generationTargets = producedTargets();
    const { requests, dispatchReceipts } = requestSet(generationTargets);
    const missing = produceEvidence(generationTargets, {
      requests,
      dispatchReceipts,
      rawResponses: [boundResponse(
        requests[0]!.requestRef,
        providerResponse("screen-no-shot", "Any title", { screenshotAvailable: false }),
      )],
    });
    assert.equal(missing.status, "produced", JSON.stringify(missing.diagnostics));
    if (missing.status === "produced") {
      const candidate = missing.directResponseEvidence.operations[0]!.candidates[0]!;
      assert.deepEqual(candidate.missingEvidence, ["screenshot"]);
      assert.deepEqual(candidate.missingDownloadedEvidence, []);
      assert.equal(candidate.disposition, "excluded_missing_render_evidence");
    }

    const downloadFailure = produceEvidence(generationTargets, {
      requests,
      dispatchReceipts,
      rawResponses: [boundResponse(
        requests[0]!.requestRef,
        providerResponse("screen-download-failed", "Any title", {
          screenshotDownloaded: false,
        }),
      )],
    });
    assert.equal(downloadFailure.status, "produced", JSON.stringify(downloadFailure.diagnostics));
    if (downloadFailure.status === "produced") {
      const candidate = downloadFailure.directResponseEvidence.operations[0]!.candidates[0]!;
      assert.deepEqual(candidate.missingEvidence, []);
      assert.deepEqual(candidate.missingDownloadedEvidence, ["screenshot"]);
      assert.equal(candidate.disposition, "excluded_download_failure");
    }

    const providerAuthoredIdentity: any = providerResponse("screen-forged-target", "Any title");
    providerAuthoredIdentity.screens[0].targetRef = requests[0]!.targetRef;
    const rejected = produceEvidence(generationTargets, {
      requests,
      dispatchReceipts,
      rawResponses: [boundResponse(requests[0]!.requestRef, providerAuthoredIdentity)],
    });
    assert.equal(rejected.status, "rejected");
    if (rejected.status !== "rejected") return;
    assert.deepEqual(rejected.rejectionCodes, ["DIRECT_RESPONSE_V3_PROVIDER_RESPONSE_INVALID"]);
  });

  it("requires exact request/dispatch/response cardinality and scopes screen IDs to request refs", () => {
    const generationTargets = duplicateTitleTargets();
    const input = requestSet(generationTargets);
    const missing = produceEvidence(generationTargets, {
      requests: input.requests,
      dispatchReceipts: input.dispatchReceipts,
      rawResponses: input.rawResponses.slice(0, 1),
    });
    assert.equal(missing.status, "rejected");
    if (missing.status === "rejected") {
      assert.deepEqual(missing.rejectionCodes, ["DIRECT_RESPONSE_V3_RAW_RESPONSE_SET_INVALID"]);
    }

    const duplicateScreen = produceEvidence(generationTargets, {
      requests: input.requests,
      dispatchReceipts: input.dispatchReceipts,
      rawResponses: input.requests.map((request) => boundResponse(
        request.requestRef,
        providerResponse("globally-duplicate-screen", "Same human title"),
      )),
    });
    assert.equal(duplicateScreen.status, "produced", JSON.stringify(duplicateScreen.diagnostics));
    if (duplicateScreen.status === "produced") {
      assert.equal(duplicateScreen.directResponseEvidence.operations.length, 2);
      assert.equal(new Set(
        duplicateScreen.directResponseEvidence.operations.map((operation) =>
          `${operation.request.requestRef}\0${operation.candidates[0]!.screenId}`),
      ).size, 2);
    }

    const incompleteDispatch = produceEvidence(generationTargets, {
      requests: input.requests,
      dispatchReceipts: input.dispatchReceipts.slice(0, 1),
      rawResponses: input.rawResponses,
    });
    assert.equal(incompleteDispatch.status, "rejected");
    if (incompleteDispatch.status === "rejected") {
      assert.deepEqual(
        incompleteDispatch.rejectionCodes,
        ["DIRECT_RESPONSE_V3_DISPATCH_RECEIPT_SET_INVALID"],
      );
    }
  });

  it("rejects wrong target/hash/key/request and dispatch receipts, including fully rehashed requests", () => {
    const generationTargets = producedTargets();
    const base = requestSet(generationTargets);
    for (const mutate of [
      (request: any) => { request.targetHash = "a".repeat(64); },
      (request: any) => { request.requestScreenKey = "route:forged;surface:forged"; },
      (request: any) => { request.generationTargetsPayloadHash = "b".repeat(64); },
      (request: any) => { request.stageId = "DSGS_999"; },
    ]) {
      const request = clone(base.requests[0]!);
      mutate(request);
      rehashRequest(request);
      assert.equal(DesignSourceGenerationRequestV3Schema.safeParse(request).success, true);
      const dispatchReceipt = dispatchFor(request, 99);
      const result = produceEvidence(generationTargets, {
        requests: [request],
        dispatchReceipts: [dispatchReceipt],
        rawResponses: [boundResponse(
          request.requestRef,
          providerResponse("screen-forged-request", "Any title"),
        )],
      });
      assert.equal(result.status, "rejected");
      if (result.status !== "rejected") continue;
      assert.equal(result.rejectionCodes.includes("DIRECT_RESPONSE_V3_REQUEST_TARGET_MISMATCH"), true);
    }

    const badRequest = clone(base.requests[0]!);
    badRequest.receiptHash = "c".repeat(64);
    const badRequestResult = produceEvidence(generationTargets, {
      requests: [badRequest],
      dispatchReceipts: base.dispatchReceipts,
      rawResponses: base.rawResponses,
    });
    assert.equal(badRequestResult.status, "rejected");
    if (badRequestResult.status === "rejected") {
      assert.deepEqual(badRequestResult.rejectionCodes, ["DIRECT_RESPONSE_V3_REQUEST_INVALID"]);
    }

    const badDispatch = clone(base.dispatchReceipts[0]!);
    badDispatch.requestReceiptHash = "d".repeat(64);
    rehashDispatch(badDispatch);
    assert.equal(DesignSourceGenerationDispatchReceiptV3Schema.safeParse(badDispatch).success, true);
    const badDispatchResult = produceEvidence(generationTargets, {
      requests: base.requests,
      dispatchReceipts: [badDispatch],
      rawResponses: base.rawResponses,
    });
    assert.equal(badDispatchResult.status, "rejected");
    if (badDispatchResult.status === "rejected") {
      assert.deepEqual(
        badDispatchResult.rejectionCodes,
        ["DIRECT_RESPONSE_V3_DISPATCH_RECEIPT_SET_INVALID"],
      );
    }
  });

  it("rejects fully rehashed forged targets before request identity is produced", () => {
    const generationTargets = producedTargets();
    const productSpec = sourceProductSpec(generationTargets);
    const forged = clone(generationTargets);
    forged.targets[0]!.expectedScreenTitle = "Caller-authored forged title";
    forged.targets[0]!.targetHash = hashDesignGenerationTargetV3(forged.targets[0]!);
    forged.targetsHash = hashCanonicalJson(forged.targets);
    const { payloadHash: _payloadHash, ...payload } = forged;
    forged.payloadHash = hashDesignGenerationTargetsV3(payload);
    assert.equal(DesignGenerationTargetsV3Schema.safeParse(forged).success, true);

    const forgedAuthority = {
      ...generationAuthorityFor(generationTargets),
      generationTargetsHash: hashCanonicalJson(forged),
    };
    const result = produceDesignSourceGenerationRequestV3({
      productSpec,
      generationTargets: forged,
      generationAuthority: forgedAuthority,
      targetRefs: [forged.targets[0]!.targetId],
      ordinal: 1,
      retryAuthority: null,
      prompt: "Generate forged target",
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.deepEqual(
        result.rejectionCodes,
        ["DESIGN_REQUEST_V3_GENERATION_TARGETS_INVALID"],
      );
    }
  });

  it("rejects wrong provider, model, device, or policy at dispatch and after full rehash", () => {
    const generationTargets = producedTargets();
    const base = requestSet(generationTargets);
    const canonicalAuthority = generationAuthorityFor(generationTargets);
    for (const mutate of [
      (authority: any) => { authority.provider = "wrong-provider"; },
      (authority: any) => { authority.model = "wrong-model"; },
      (authority: any) => { authority.deviceType = "MOBILE"; },
      (authority: any) => { authority.selectionPolicyHash = "e".repeat(64); },
    ]) {
      const wrongAuthority = clone(canonicalAuthority);
      mutate(wrongAuthority);
      const dispatch = produceDesignSourceGenerationDispatchReceiptV3({
        request: base.requests[0],
        dispatchedGenerationAuthority: wrongAuthority,
        externalOperationId: "wrong-dispatch-config",
      });
      assert.equal(dispatch.status, "rejected");
      if (dispatch.status === "rejected") {
        assert.deepEqual(dispatch.rejectionCodes, ["DESIGN_DISPATCH_V3_AUTHORITY_MISMATCH"]);
      }

      const request = clone(base.requests[0]!);
      request.generationAuthorityHash =
        hashDesignSourceGenerationAuthorityBindingV3(wrongAuthority);
      rehashRequest(request);
      const forgedDispatch = clone(base.dispatchReceipts[0]!);
      forgedDispatch.requestRef = request.requestRef;
      forgedDispatch.requestReceiptHash = request.receiptHash;
      forgedDispatch.dispatchedGenerationAuthorityHash = request.generationAuthorityHash;
      rehashDispatch(forgedDispatch);
      assert.equal(DesignSourceGenerationRequestV3Schema.safeParse(request).success, true);
      assert.equal(
        DesignSourceGenerationDispatchReceiptV3Schema.safeParse(forgedDispatch).success,
        true,
      );
      const result = produceEvidence(generationTargets, {
        requests: [request],
        dispatchReceipts: [forgedDispatch],
        rawResponses: [boundResponse(
          request.requestRef,
          providerResponse("screen-wrong-dispatch", "Any title"),
        )],
      });
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") {
        assert.deepEqual(result.rejectionCodes, ["DIRECT_RESPONSE_V3_REQUEST_INVALID"]);
      }
    }
  });

  it("fails closed on unbounded request, dispatch, and raw-transport sets", () => {
    const generationTargets = producedTargets();
    const base = requestSet(generationTargets);
    const tooManyRequests = produceEvidence(generationTargets, {
      requests: Array.from({ length: 1_001 }, () => base.requests[0]!),
      dispatchReceipts: base.dispatchReceipts,
      rawResponses: base.rawResponses,
    });
    assert.equal(tooManyRequests.status, "rejected");
    if (tooManyRequests.status === "rejected") {
      assert.deepEqual(tooManyRequests.rejectionCodes, ["DIRECT_RESPONSE_V3_REQUEST_INVALID"]);
    }

    const tooManyDispatches = produceEvidence(generationTargets, {
      requests: base.requests,
      dispatchReceipts: Array.from({ length: 1_001 }, () => base.dispatchReceipts[0]!),
      rawResponses: base.rawResponses,
    });
    assert.equal(tooManyDispatches.status, "rejected");
    if (tooManyDispatches.status === "rejected") {
      assert.deepEqual(
        tooManyDispatches.rejectionCodes,
        ["DIRECT_RESPONSE_V3_DISPATCH_RECEIPT_INVALID"],
      );
    }

    const tooManyResponses = produceEvidence(generationTargets, {
      requests: base.requests,
      dispatchReceipts: base.dispatchReceipts,
      rawResponses: Array.from({ length: 1_001 }, () => base.rawResponses[0]!),
    });
    assert.equal(tooManyResponses.status, "rejected");
    if (tooManyResponses.status === "rejected") {
      assert.deepEqual(
        tooManyResponses.rejectionCodes,
        ["DIRECT_RESPONSE_V3_RAW_RESPONSE_SET_INVALID"],
      );
    }
  });

  it("exactly reproduces canonical evidence and rejects a fully rehashed evidence forgery", () => {
    const generationTargets = producedTargets();
    const input = requestSet(generationTargets);
    const produced = produceEvidence(generationTargets, {
      ...input,
    });
    assert.equal(produced.status, "produced", JSON.stringify(produced.diagnostics));
    if (produced.status !== "produced") return;
    assert.equal(
      StitchDirectResponseEvidenceV3Schema.safeParse(produced.directResponseEvidence).success,
      true,
    );
    const verified = verifyEvidence(generationTargets, {
      ...input,
      directResponseEvidence: produced.directResponseEvidence,
    });
    assert.equal(verified.status, "verified", JSON.stringify(verified.diagnostics));
    if (verified.status !== "verified") return;
    assert.deepEqual(
      verified.directResponseEvidence,
      produced.directResponseEvidence,
      "verifier returns the freshly reproduced canonical artifact",
    );
    assert.notStrictEqual(
      verified.directResponseEvidence,
      produced.directResponseEvidence,
    );
    const operation = verified.directResponseEvidence.operations[0]!;
    assert.equal(
      operation.rawTransportArtifactHash,
      input.rawResponses[0]!.rawTransportArtifactHash,
    );
    assert.equal(
      operation.providerResponseProjectionHash,
      hashCanonicalJson(input.rawResponses[0]!.response),
    );

    const rawTransportTamper = clone(input.rawResponses);
    rawTransportTamper[0]!.rawTransportArtifactHash = "f".repeat(64);
    const rawTransportRejected = verifyEvidence(generationTargets, {
      ...input,
      rawResponses: rawTransportTamper,
      directResponseEvidence: produced.directResponseEvidence,
    });
    assert.equal(rawTransportRejected.status, "rejected");
    if (rawTransportRejected.status === "rejected") {
      assert.deepEqual(
        rawTransportRejected.rejectionCodes,
        ["DIRECT_RESPONSE_V3_AUTHORITY_MISMATCH"],
      );
    }

    const projectionTamper = clone(input.rawResponses);
    (projectionTamper[0]!.response as StitchDirectProviderResponseV3)
      .screens[0]!.title = "Tampered strict projection";
    const projectionRejected = verifyEvidence(generationTargets, {
      ...input,
      rawResponses: projectionTamper,
      directResponseEvidence: produced.directResponseEvidence,
    });
    assert.equal(projectionRejected.status, "rejected");
    if (projectionRejected.status === "rejected") {
      assert.deepEqual(
        projectionRejected.rejectionCodes,
        ["DIRECT_RESPONSE_V3_AUTHORITY_MISMATCH"],
      );
    }

    const forged = clone(produced.directResponseEvidence);
    forged.operations[0]!.candidates[0]!.title = "Fully rehashed forged title";
    rehashEvidence(forged);
    assert.equal(StitchDirectResponseEvidenceV3Schema.safeParse(forged).success, true);
    const rejected = verifyEvidence(generationTargets, {
      ...input,
      directResponseEvidence: forged,
    });
    assert.equal(rejected.status, "rejected");
    if (rejected.status !== "rejected") return;
    assert.deepEqual(rejected.rejectionCodes, ["DIRECT_RESPONSE_V3_AUTHORITY_MISMATCH"]);
  });
});
