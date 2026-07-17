import { createHash } from "node:crypto";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceDesignGenerationTargetsV3 } from "../../src/product-compiler/producers/design-targets-v3.js";
import {
  produceDesignSourceGenerationDispatchReceiptV3,
  produceDesignSourceGenerationRequestV3,
  produceStitchDirectResponseEvidenceV3,
} from "../../src/product-compiler/producers/stitch-direct-response-v3.js";
import {
  produceStitchRenderedSemanticsV3,
  verifyStitchRenderedSemanticsV3,
} from "../../src/product-compiler/producers/stitch-rendered-semantics-v3.js";
import type { DesignGenerationTargetsV3 } from "../../src/product-compiler/schemas/design-generation-targets-v3.js";
import type { DesignSourceGenerationAuthorityV1 } from "../../src/product-compiler/schemas/design-source-generation-authority-v1.js";
import {
  StitchRenderedSemanticsV3Schema,
  hashStitchRenderedCandidateV3,
  hashStitchRenderedSemanticsV3,
  type StitchRenderedSemanticsV3,
} from "../../src/product-compiler/schemas/stitch-rendered-semantics-v3.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import { buildContainedGameProductSpecV2 } from "./fixtures/product-semantics-v2.js";
import { validStitchHtml, validStitchPng } from "./fixtures/stitch-artifacts.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function productSpecWithTwoTargetsAndInputs(): ProductSpecV2 {
  const productSpec: any = clone(buildContainedGameProductSpecV2());
  const action = productSpec.actions[0]!;
  action.input.fields = [
    { name: "description", valueType: "string", required: true },
    { name: "title", valueType: "string", required: true },
  ];
  action.evidenceScenario.targetInputValues = {
    description: "Exact description",
    title: "Exact title",
  };
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
  return ProductSpecV2Schema.parse(productSpec);
}

function generationTargets(productSpec: ProductSpecV2): DesignGenerationTargetsV3 {
  const result = produceDesignGenerationTargetsV3(productSpec);
  assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
  if (result.status !== "produced") throw new Error("Expected GenerationTargetsV3");
  return result.generationTargets;
}

function generationAuthority(
  productSpec: ProductSpecV2,
  targets: DesignGenerationTargetsV3,
): DesignSourceGenerationAuthorityV1 {
  return {
    schema: "setfarm.design-source-generation-authority.v1",
    runId: "rendered-semantics-v3-test",
    originClaimId: 1,
    productSpecHash: hashCanonicalJson(productSpec),
    generationTargetsHash: hashCanonicalJson(targets),
    promptContractHash: "1".repeat(64),
    renderPolicyHash: "2".repeat(64),
    selectionPolicyHash: "3".repeat(64),
    producerReleaseSha: "4".repeat(40),
    provider: "stitch",
    model: "stitch-v3",
    deviceType: "DESKTOP",
    targetRefs: targets.targets.map((target) => target.targetId).sort(),
    maximumAttempts: 2,
  };
}

type FixtureOptions = Readonly<{
  duplicateControl?: boolean;
  duplicateRootSurface?: boolean;
  duplicateAccessibility?: boolean;
  omitAccessibility?: boolean;
  excludeSecondTarget?: boolean;
  omitFirstContainedSurface?: boolean;
  omitFirstInput?: boolean;
  wrongFirstCodec?: boolean;
}>;

function targetHtml(
  target: DesignGenerationTargetsV3["targets"][number],
  options: FixtureOptions,
  marker: string,
): Buffer {
  const placement = target.requiredControlPlacements[0];
  const control = placement
    ? `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Save</button>`
    : "";
  const inputs = placement?.actionInputTransports.map((transport, index) => {
    if (index === 0 && options.omitFirstInput) return "";
    const codec = index === 0 && options.wrongFirstCodec
      ? "json-number.v2"
      : transport.codecId;
    const tag = transport.fieldRef === "description" ? "textarea" : "input";
    const attributes = [
      `data-action-input-slot="${placement.controlSlotRef}"`,
      `data-action-input="${transport.actionInputRef}"`,
      `data-action-input-codec="${codec}"`,
      ...(tag === "input" ? ["type=\"text\""] : []),
    ].join(" ");
    return tag === "textarea"
      ? `<textarea ${attributes}></textarea>`
      : `<input ${attributes}>`;
  }).join("") ?? "";
  const placementMarkup = `${control}${options.duplicateControl ? control : ""}${inputs}`;
  const accessibilityMarkup = (surfaceRef: string) => target.requiredObservableSelectors
    .filter((observable) =>
      observable.selector.kind === "accessibility"
      && observable.selector.surfaceRef === surfaceRef)
    .map((observable) => {
      if (observable.selector.kind !== "accessibility" || options.omitAccessibility) {
        return "";
      }
      const marker = `<output role="${observable.selector.role}" aria-label="${observable.selector.name}"></output>`;
      return options.duplicateAccessibility ? `${marker}${marker}` : marker;
    }).join("");
  const surfaceMarkup = (surfaceRef: string) => [
    placement?.surfaceRef === surfaceRef ? placementMarkup : "",
    accessibilityMarkup(surfaceRef),
  ].join("");
  const contained = target.containedSurfaceRefs.map((surfaceRef, index) =>
    index === 0 && options.omitFirstContainedSurface
      ? ""
      : `<section data-surface-id="${surfaceRef}">${surfaceMarkup(surfaceRef)}</section>`)
    .join("");
  const root = [
    `<main data-surface-id="${target.surfaceRef}">`,
    surfaceMarkup(target.surfaceRef),
    contained,
    "</main>",
  ].join("");
  return validStitchHtml([
    root,
    options.duplicateRootSurface
      ? `<aside data-surface-id="${target.surfaceRef}"></aside>`
      : "",
  ].join(""), marker);
}

function fixture(options: FixtureOptions = {}) {
  const productSpec = productSpecWithTwoTargetsAndInputs();
  const targets = generationTargets(productSpec);
  const authority = generationAuthority(productSpec, targets);
  const requests = targets.targets.map((target) => {
    const result = produceDesignSourceGenerationRequestV3({
      productSpec,
      generationTargets: targets,
      generationAuthority: authority,
      targetRefs: [target.targetId],
      ordinal: 1,
      retryAuthority: null,
      prompt: `Generate ${target.targetId}`,
    });
    assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
    if (result.status !== "produced") throw new Error("Expected request");
    return result.request;
  });
  const dispatchReceipts = requests.map((request, index) => {
    const result = produceDesignSourceGenerationDispatchReceiptV3({
      request,
      dispatchedGenerationAuthority: authority,
      externalOperationId: `rendered-v3-operation-${index + 1}`,
    });
    assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
    if (result.status !== "produced") throw new Error("Expected dispatch receipt");
    return result.dispatchReceipt;
  });
  const artifacts = requests.map((request, index) => ({
    requestRef: request.requestRef,
    screenId: "provider-local-screen",
    htmlBytes: targetHtml(targets.targets[index]!, options, `rendered-v3-${index}`),
    screenshotBytes: validStitchPng(index + 31),
  }));
  const rawResponses = requests.map((request, index) => {
    const artifact = artifacts[index]!;
    const excludeHtml = options.excludeSecondTarget && index === 1;
    const response = {
      schema: "setfarm.stitch-direct-provider-response.v3" as const,
      screens: [{
        screenId: artifact.screenId,
        title: "Duplicate human title",
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: !excludeHtml,
        screenshotAvailable: true,
        htmlSourceRefHash: excludeHtml
          ? null
          : sha256(`html-source-${request.requestRef}`),
        screenshotSourceRefHash: sha256(`screenshot-source-${request.requestRef}`),
        htmlDownloadedArtifactHash: excludeHtml ? null : sha256(artifact.htmlBytes),
        screenshotDownloadedArtifactHash: sha256(artifact.screenshotBytes),
      }],
    };
    return {
      requestRef: request.requestRef,
      rawTransportArtifactHash: hashCanonicalJson({
        schema: "test.raw-transport.v1",
        requestRef: request.requestRef,
      }),
      response,
    };
  });
  const direct = produceStitchDirectResponseEvidenceV3({
    productSpec,
    generationTargets: targets,
    generationAuthority: authority,
    requests,
    dispatchReceipts,
    rawResponses,
  });
  assert.equal(direct.status, "produced", JSON.stringify(direct.diagnostics));
  if (direct.status !== "produced") throw new Error("Expected direct evidence");
  return {
    productSpec,
    generationTargets: targets,
    generationAuthority: authority,
    requests,
    dispatchReceipts,
    rawResponses,
    directResponseEvidence: direct.directResponseEvidence,
    artifacts,
  };
}

function withFirstArtifactBytes(
  input: ReturnType<typeof fixture>,
  overrides: Readonly<{
    htmlBytes?: Uint8Array;
    screenshotBytes?: Uint8Array;
  }>,
) {
  const artifacts: any[] = clone(input.artifacts);
  const rawResponses: any[] = clone(input.rawResponses);
  if (overrides.htmlBytes) artifacts[0]!.htmlBytes = overrides.htmlBytes;
  if (overrides.screenshotBytes) {
    artifacts[0]!.screenshotBytes = overrides.screenshotBytes;
  }
  rawResponses[0]!.response.screens[0]!.htmlDownloadedArtifactHash = sha256(
    artifacts[0]!.htmlBytes,
  );
  rawResponses[0]!.response.screens[0]!.screenshotDownloadedArtifactHash = sha256(
    artifacts[0]!.screenshotBytes,
  );
  const direct = produceStitchDirectResponseEvidenceV3({
    productSpec: input.productSpec,
    generationTargets: input.generationTargets,
    generationAuthority: input.generationAuthority,
    requests: input.requests,
    dispatchReceipts: input.dispatchReceipts,
    rawResponses,
  });
  assert.equal(direct.status, "produced", JSON.stringify(direct.diagnostics));
  if (direct.status !== "produced") throw new Error("Expected direct evidence");
  return {
    ...input,
    artifacts,
    rawResponses,
    directResponseEvidence: direct.directResponseEvidence,
  };
}

function withAggregateHtmlWorkAboveLimit(input: ReturnType<typeof fixture>) {
  const rawResponses: any[] = clone(input.rawResponses);
  const sharedHtmlBytes = new Uint8Array(8 * 1024 * 1024);
  const screenshotBytes = input.artifacts[0]!.screenshotBytes;
  const screens = Array.from({ length: 9 }, (_, index) => ({
    ...rawResponses[0]!.response.screens[0]!,
    screenId: `aggregate-screen-${index + 1}`,
    responsePaths: [`$result.screens[${index}]`],
    htmlSourceRefHash: sha256(`aggregate-html-source-${index + 1}`),
    screenshotSourceRefHash: sha256(`aggregate-shot-source-${index + 1}`),
    htmlDownloadedArtifactHash: sha256(sharedHtmlBytes),
    screenshotDownloadedArtifactHash: sha256(screenshotBytes),
  }));
  rawResponses[0]!.response.screens = screens;
  const artifacts = [
    ...screens.map((screen) => ({
      requestRef: input.requests[0]!.requestRef,
      screenId: screen.screenId,
      htmlBytes: sharedHtmlBytes,
      screenshotBytes,
    })),
    ...input.artifacts.slice(1),
  ];
  const direct = produceStitchDirectResponseEvidenceV3({
    productSpec: input.productSpec,
    generationTargets: input.generationTargets,
    generationAuthority: input.generationAuthority,
    requests: input.requests,
    dispatchReceipts: input.dispatchReceipts,
    rawResponses,
  });
  assert.equal(direct.status, "produced", JSON.stringify(direct.diagnostics));
  if (direct.status !== "produced") throw new Error("Expected direct evidence");
  return {
    ...input,
    artifacts,
    rawResponses,
    directResponseEvidence: direct.directResponseEvidence,
  };
}

function rehashRenderedSemantics(value: StitchRenderedSemanticsV3): void {
  for (const candidate of value.candidates) {
    const { candidateHash: _candidateHash, ...payload } = candidate;
    candidate.candidateHash = hashStitchRenderedCandidateV3(payload);
  }
  value.candidatesHash = hashCanonicalJson(value.candidates);
  const { payloadHash: _payloadHash, ...payload } = value;
  value.payloadHash = hashStitchRenderedSemanticsV3(payload);
}

describe("Stitch rendered semantics v3 authority", () => {
  it("reproduces composite identity, multi-input mappings, and exact target authority", () => {
    const input = fixture();
    assert.equal(new Set(
      input.generationTargets.targets.map((target) => target.expectedScreenTitle),
    ).size, 1);
    const produced = produceStitchRenderedSemanticsV3(input);
    assert.equal(produced.status, "produced_unverified_browser_cas", JSON.stringify(produced.diagnostics));
    if (produced.status === "rejected") return;
    assert.deepEqual(produced.renderedSemantics.verificationBoundary, {
      artifactReproduction: "deterministic_exact",
      casRetrieval: "unverified_external_bytes",
      browserReplay: "unverified_not_performed",
    });
    assert.equal(produced.renderedSemantics.candidates.length, 2);
    assert.equal(new Set(
      produced.renderedSemantics.candidates.map((candidate) => candidate.screenId),
    ).size, 1, "provider-local screen IDs may repeat across request refs");
    assert.equal(new Set(
      produced.renderedSemantics.candidates.map((candidate) =>
        `${candidate.requestRef}\0${candidate.screenId}`),
    ).size, 2);

    const withInputs = produced.renderedSemantics.candidates.find((candidate) =>
      candidate.actionInputMappings.length > 0)!;
    const targetAuthority = produced.renderedSemantics.targetAuthorities.find(
      (authority) => authority.targetRef === withInputs.targetRef,
    )!;
    assert.equal(withInputs.actionInputMappings.length, 2);
    assert.deepEqual(
      withInputs.actionInputMappings.map((mapping) => [
        mapping.controlSlotRef,
        mapping.actionInputRef,
        mapping.codecId,
      ]),
      targetAuthority.actionInputTransports.map((transport) => {
        const mapping = withInputs.actionInputMappings.find((candidate) =>
          candidate.controlSlotRef === transport.controlSlotRef
          && candidate.actionInputRef === transport.actionInputRef)!;
        return [mapping.controlSlotRef, mapping.actionInputRef, mapping.codecId];
      }),
    );
    const target = input.generationTargets.targets.find((candidate) =>
      candidate.targetId === withInputs.targetRef)!;
    assert.equal(targetAuthority.targetHash, target.targetHash);
    assert.equal(withInputs.targetAuthorityHash, targetAuthority.authorityHash);
    assert.equal(targetAuthority.controlsHash, hashCanonicalJson(
      targetAuthority.controls,
    ));
    assert.equal(targetAuthority.actions[0]!.actionHash, hashCanonicalJson(
      target.requiredActions[0],
    ));
    assert.equal(
      targetAuthority.evidencePredicatesHash,
      hashCanonicalJson(targetAuthority.evidencePredicates),
    );
    assert.equal(
      targetAuthority.observablesHash,
      hashCanonicalJson(targetAuthority.observables),
    );
    assert.equal(withInputs.surfaceMappings.length, targetAuthority.surfaces.length);
    assert.equal(withInputs.observableMappings.length, targetAuthority.observables.length);
    assert.ok(withInputs.observableMappings.every((mapping) =>
      mapping.ownerKind === "surface" || mapping.ownerKind === "control"));
    const accessibility = withInputs.observableMappings.find((mapping) =>
      mapping.selectorKind === "accessibility");
    assert.ok(accessibility);
    assert.equal(accessibility.accessibilityRole, "status");
    assert.equal(accessibility.accessibilityName, "Game status");
    assert.notEqual(
      accessibility.selectorElementRef,
      accessibility.ownerElementRef,
      "accessibility selector evidence is distinct from its owning surface element",
    );

    const reproduced = verifyStitchRenderedSemanticsV3({
      ...input,
      renderedSemantics: produced.renderedSemantics,
    });
    assert.equal(reproduced.status, "reproduced_unverified_browser_cas", JSON.stringify(reproduced.diagnostics));
    if (reproduced.status === "rejected") return;
    assert.deepEqual(reproduced.renderedSemantics, produced.renderedSemantics);
    assert.notStrictEqual(reproduced.renderedSemantics, produced.renderedSemantics);
  });

  it("fails closed on missing, duplicate, and wrong-codec DOM mappings", () => {
    const duplicate = produceStitchRenderedSemanticsV3(fixture({ duplicateControl: true }));
    assert.equal(duplicate.status, "rejected");
    if (duplicate.status === "rejected") {
      assert.deepEqual(
        duplicate.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_CONTROL_MAPPING_DUPLICATE"],
      );
    }

    const missingInput = produceStitchRenderedSemanticsV3(fixture({ omitFirstInput: true }));
    assert.equal(missingInput.status, "rejected");
    if (missingInput.status === "rejected") {
      assert.deepEqual(
        missingInput.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_MISSING"],
      );
    }

    const wrongCodec = produceStitchRenderedSemanticsV3(fixture({ wrongFirstCodec: true }));
    assert.equal(wrongCodec.status, "rejected");
    if (wrongCodec.status === "rejected") {
      assert.deepEqual(
        wrongCodec.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ACTION_INPUT_CODEC_MISMATCH"],
      );
    }
  });

  it("fails closed on missing and duplicate exact surface ownership", () => {
    const duplicate = produceStitchRenderedSemanticsV3(fixture({
      duplicateRootSurface: true,
    }));
    assert.equal(duplicate.status, "rejected");
    if (duplicate.status === "rejected") {
      assert.deepEqual(
        duplicate.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_SURFACE_MAPPING_DUPLICATE"],
      );
    }

    const input = fixture({ omitFirstContainedSurface: true });
    const targetWithContainedSurface = input.generationTargets.targets.find((target) =>
      target.containedSurfaceRefs.length > 0);
    assert.ok(targetWithContainedSurface);
    const missing = produceStitchRenderedSemanticsV3(input);
    assert.equal(missing.status, "rejected");
    if (missing.status === "rejected") {
      assert.deepEqual(
        missing.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_SURFACE_MAPPING_MISSING"],
      );
    }
  });

  it("requires one admitted candidate for every exact target operation", () => {
    const rejected = produceStitchRenderedSemanticsV3(fixture({
      excludeSecondTarget: true,
    }));
    assert.equal(rejected.status, "rejected");
    if (rejected.status === "rejected") {
      assert.deepEqual(
        rejected.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_TARGET_ADMISSION_INCOMPLETE"],
      );
    }
  });

  it("requires exactly one static accessibility role/name source mapping", () => {
    const missing = produceStitchRenderedSemanticsV3(fixture({
      omitAccessibility: true,
    }));
    assert.equal(missing.status, "rejected");
    if (missing.status === "rejected") {
      assert.deepEqual(
        missing.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ACCESSIBILITY_MAPPING_MISSING"],
      );
    }

    const duplicate = produceStitchRenderedSemanticsV3(fixture({
      duplicateAccessibility: true,
    }));
    assert.equal(duplicate.status, "rejected");
    if (duplicate.status === "rejected") {
      assert.deepEqual(
        duplicate.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ACCESSIBILITY_MAPPING_DUPLICATE"],
      );
    }
  });

  it("rejects wrong artifact cardinality, missing bytes, and CAS byte-hash tamper", () => {
    const input = fixture();
    const missingArtifact = produceStitchRenderedSemanticsV3({
      ...input,
      artifacts: input.artifacts.slice(0, 1),
    });
    assert.equal(missingArtifact.status, "rejected");
    if (missingArtifact.status === "rejected") {
      assert.deepEqual(
        missingArtifact.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ARTIFACT_SET_INVALID"],
      );
    }

    const missingBytes = clone(input.artifacts);
    delete (missingBytes[0] as any).screenshotBytes;
    const missingBytesResult = produceStitchRenderedSemanticsV3({
      ...input,
      artifacts: missingBytes,
    });
    assert.equal(missingBytesResult.status, "rejected");
    if (missingBytesResult.status === "rejected") {
      assert.deepEqual(
        missingBytesResult.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ARTIFACT_BYTES_MISSING"],
      );
    }

    const tamperedBytes = clone(input.artifacts);
    (tamperedBytes[0] as any).htmlBytes = validStitchHtml(
      "<main>tampered but valid source</main>",
      "tampered-rendered-v3",
    );
    const tamperedBytesResult = produceStitchRenderedSemanticsV3({
      ...input,
      artifacts: tamperedBytes,
    });
    assert.equal(tamperedBytesResult.status, "rejected");
    if (tamperedBytesResult.status === "rejected") {
      assert.deepEqual(
        tamperedBytesResult.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ARTIFACT_HASH_MISMATCH"],
      );
    }
  });

  it("bounds bytes before decoding and bounds the parsed semantic element set", () => {
    const oversized = withFirstArtifactBytes(fixture(), {
      htmlBytes: new Uint8Array((8 * 1024 * 1024) + 1),
    });
    const capacityRejected = produceStitchRenderedSemanticsV3(oversized);
    assert.equal(capacityRejected.status, "rejected");
    if (capacityRejected.status === "rejected") {
      assert.deepEqual(
        capacityRejected.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ARTIFACT_CAPACITY_EXCEEDED"],
      );
    }

    const invalidUtf8 = withFirstArtifactBytes(fixture(), {
      htmlBytes: Buffer.concat([
        validStitchHtml("<main>fatal utf8</main>", "invalid-utf8-v3"),
        Buffer.from([0xff]),
      ]),
    });
    const encodingRejected = produceStitchRenderedSemanticsV3(invalidUtf8);
    assert.equal(encodingRejected.status, "rejected");
    if (encodingRejected.status === "rejected") {
      assert.deepEqual(
        encodingRejected.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_HTML_ENCODING_INVALID"],
      );
    }

    const tooManyElements = withFirstArtifactBytes(fixture(), {
      htmlBytes: validStitchHtml(
        "<i></i>".repeat(100_001),
        "semantic-element-capacity-v3",
      ),
    });
    const elementRejected = produceStitchRenderedSemanticsV3(tooManyElements);
    assert.equal(elementRejected.status, "rejected");
    if (elementRejected.status === "rejected") {
      assert.deepEqual(
        elementRejected.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ELEMENT_CAPACITY_EXCEEDED"],
      );
    }
  });

  it("rejects malformed public artifact entries and aggregate byte work", () => {
    const input = fixture();
    const malformed = produceStitchRenderedSemanticsV3({
      ...input,
      artifacts: [null, ...input.artifacts.slice(1)] as any,
    });
    assert.equal(malformed.status, "rejected");
    if (malformed.status === "rejected") {
      assert.deepEqual(
        malformed.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ARTIFACT_SET_INVALID"],
      );
    }

    const sparseArtifacts = new Array(input.artifacts.length);
    sparseArtifacts[1] = input.artifacts[1];
    const sparse = produceStitchRenderedSemanticsV3({
      ...input,
      artifacts: sparseArtifacts,
    });
    assert.equal(sparse.status, "rejected");
    if (sparse.status === "rejected") {
      assert.deepEqual(
        sparse.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ARTIFACT_SET_INVALID"],
      );
    }

    const aggregate = produceStitchRenderedSemanticsV3(
      withAggregateHtmlWorkAboveLimit(input),
    );
    assert.equal(aggregate.status, "rejected");
    if (aggregate.status === "rejected") {
      assert.deepEqual(
        aggregate.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_ARTIFACT_WORK_CAPACITY_EXCEEDED"],
      );
    }
  });

  it("rejects raw transport, provider projection, and source hash tamper upstream", () => {
    const input = fixture();
    const rawTransport = clone(input.rawResponses);
    (rawTransport[0] as any).rawTransportArtifactHash = "a".repeat(64);
    const rawRejected = produceStitchRenderedSemanticsV3({
      ...input,
      rawResponses: rawTransport,
    });
    assert.equal(rawRejected.status, "rejected");
    if (rawRejected.status === "rejected") {
      assert.deepEqual(
        rawRejected.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_DIRECT_RESPONSE_INVALID"],
      );
    }

    const projection = clone(input.rawResponses);
    (projection[0] as any).response.screens[0].title = "Projection tamper";
    const projectionRejected = produceStitchRenderedSemanticsV3({
      ...input,
      rawResponses: projection,
    });
    assert.equal(projectionRejected.status, "rejected");

    const source = clone(input.rawResponses);
    (source[0] as any).response.screens[0].htmlSourceRefHash = "b".repeat(64);
    const sourceRejected = produceStitchRenderedSemanticsV3({
      ...input,
      rawResponses: source,
    });
    assert.equal(sourceRejected.status, "rejected");
  });

  it("rejects a schema-valid fully rehashed rendered-semantics forgery", () => {
    const input = fixture();
    const produced = produceStitchRenderedSemanticsV3(input);
    assert.equal(produced.status, "produced_unverified_browser_cas", JSON.stringify(produced.diagnostics));
    if (produced.status === "rejected") return;
    const forged = clone(produced.renderedSemantics);
    forged.candidates[0]!.title = "Fully rehashed caller forgery";
    rehashRenderedSemantics(forged);
    assert.equal(StitchRenderedSemanticsV3Schema.safeParse(forged).success, true);
    const rejected = verifyStitchRenderedSemanticsV3({
      ...input,
      renderedSemantics: forged,
    });
    assert.equal(rejected.status, "rejected");
    if (rejected.status === "rejected") {
      assert.deepEqual(
        rejected.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_AUTHORITY_MISMATCH"],
      );
    }
  });
});
