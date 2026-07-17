import { createHash } from "node:crypto";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  parseStitchSemanticDomV1,
  stitchSemanticAttribute,
} from "../../src/product-compiler/stitch-semantic-dom-v1.js";
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
  STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3,
  StitchRenderedSemanticsV3Schema,
  hashStitchRenderedCandidateV3,
  hashStitchRenderedSemanticsV3,
  hashStitchRenderedStaticFailureReceiptV3,
  parseStitchRenderedSemanticsV3,
  type StitchRenderedSemanticsV3,
  type StitchRenderedStaticFailureCodeV3,
  type StitchRenderedStaticFailureReceiptV3,
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
  duplicateFirstInput?: boolean;
  duplicateRootSurface?: boolean;
  duplicateAccessibility?: boolean;
  implicitAccessibility?: boolean;
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
    const markup = tag === "textarea"
      ? `<textarea ${attributes}></textarea>`
      : `<input ${attributes}>`;
    return index === 0 && options.duplicateFirstInput ? `${markup}${markup}` : markup;
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
      const marker = options.implicitAccessibility
        ? `<output aria-label="${observable.selector.name}"></output>`
        : `<output role="${observable.selector.role}" aria-label="${observable.selector.name}"></output>`;
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
    artifacts: options.excludeSecondTarget ? artifacts.slice(0, 1) : artifacts,
  };
}

function withReproducedDirect(
  input: ReturnType<typeof fixture>,
  rawResponses: ReturnType<typeof fixture>["rawResponses"],
  artifacts: ReturnType<typeof fixture>["artifacts"],
) {
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
    rawResponses,
    directResponseEvidence: direct.directResponseEvidence,
    artifacts,
  };
}

function withBadAndGoodSibling(input: ReturnType<typeof fixture>) {
  const rawResponses: any[] = clone(input.rawResponses);
  const artifacts: any[] = clone(input.artifacts);
  const request = input.requests[0]!;
  const htmlBytes = validStitchHtml(
    "<main>missing exact surface ownership</main>",
    "a-static-bad-sibling",
  );
  const screenshotBytes = validStitchPng(91);
  rawResponses[0]!.response.screens.push({
    ...rawResponses[0]!.response.screens[0]!,
    screenId: "a-static-bad-sibling",
    responsePaths: ["$result.screens[1]"],
    htmlSourceRefHash: sha256("a-static-bad-sibling-html-source"),
    screenshotSourceRefHash: sha256("a-static-bad-sibling-screenshot-source"),
    htmlDownloadedArtifactHash: sha256(htmlBytes),
    screenshotDownloadedArtifactHash: sha256(screenshotBytes),
  });
  artifacts.push({
    requestRef: request.requestRef,
    screenId: "a-static-bad-sibling",
    htmlBytes,
    screenshotBytes,
  });
  return withReproducedDirect(input, rawResponses, artifacts);
}

function withHighDuplicateControlSibling(input: ReturnType<typeof fixture>) {
  const rawResponses: any[] = clone(input.rawResponses);
  const artifacts: any[] = clone(input.artifacts);
  const request = input.requests[0]!;
  const target = input.generationTargets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const control = `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Save</button>`;
  const htmlBytes = Buffer.from(
    Buffer.from(targetHtml(target, {}, "high-duplicate-control-sibling"))
      .toString("utf8")
      .replace(control, control.repeat(101)),
    "utf8",
  );
  const screenshotBytes = validStitchPng(92);
  rawResponses[0]!.response.screens.push({
    ...rawResponses[0]!.response.screens[0]!,
    screenId: "a-high-duplicate-control-sibling",
    responsePaths: ["$result.screens[1]"],
    htmlSourceRefHash: sha256("high-duplicate-control-sibling-html-source"),
    screenshotSourceRefHash: sha256("high-duplicate-control-sibling-shot-source"),
    htmlDownloadedArtifactHash: sha256(htmlBytes),
    screenshotDownloadedArtifactHash: sha256(screenshotBytes),
  });
  artifacts.push({
    requestRef: request.requestRef,
    screenId: "a-high-duplicate-control-sibling",
    htmlBytes,
    screenshotBytes,
  });
  return withReproducedDirect(input, rawResponses, artifacts);
}

function withAllAdmittedBad(input: ReturnType<typeof fixture>) {
  const rawResponses: any[] = clone(input.rawResponses);
  const artifacts: any[] = clone(input.artifacts);
  for (const [index, artifact] of artifacts.entries()) {
    artifact.htmlBytes = validStitchHtml(
      "<main>missing all exact surface ownership</main>",
      `all-static-bad-${index}`,
    );
    rawResponses[index]!.response.screens[0]!.htmlDownloadedArtifactHash = sha256(
      artifact.htmlBytes,
    );
  }
  return withReproducedDirect(input, rawResponses, artifacts);
}

function withoutAnyAdmission(input: ReturnType<typeof fixture>) {
  const rawResponses: any[] = clone(input.rawResponses);
  for (const raw of rawResponses) {
    const screen = raw.response.screens[0]!;
    screen.htmlAvailable = false;
    screen.htmlSourceRefHash = null;
    screen.htmlDownloadedArtifactHash = null;
  }
  return withReproducedDirect(input, rawResponses, []);
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

function withFirstHtmlTransform(
  input: ReturnType<typeof fixture>,
  transform: (html: string) => string,
) {
  return withFirstArtifactBytes(input, {
    htmlBytes: Buffer.from(transform(Buffer.from(
      input.artifacts[0]!.htmlBytes,
    ).toString("utf8")), "utf8"),
  });
}

function staticFailureReceipt(
  input: ReturnType<typeof fixture>,
  code: StitchRenderedStaticFailureCodeV3,
): StitchRenderedStaticFailureReceiptV3 {
  const produced = produceStitchRenderedSemanticsV3(input);
  assert.equal(
    produced.status,
    "produced_unverified_browser_cas",
    JSON.stringify(produced.diagnostics),
  );
  if (produced.status === "rejected") {
    throw new Error(`Expected candidate-local ${code}`);
  }
  const outcome = produced.renderedSemantics.candidates.find((candidate) =>
    candidate.projectionStatus === "static_source_rejected"
    && candidate.failureReceipts.some((receipt) => receipt.code === code));
  if (!outcome || outcome.projectionStatus !== "static_source_rejected") {
    throw new Error(`Missing candidate-local ${code}`);
  }
  const receipt = outcome.failureReceipts.find((candidate) => candidate.code === code);
  if (!receipt) throw new Error(`Missing receipt ${code}`);
  return receipt;
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
    if (candidate.projectionStatus === "static_source_rejected") {
      for (const receipt of candidate.failureReceipts) {
        const { receiptHash: _receiptHash, ...receiptPayload } = receipt;
        receipt.receiptHash = hashStitchRenderedStaticFailureReceiptV3(receiptPayload);
      }
      candidate.failureReceipts.sort((left, right) =>
        left.receiptHash.localeCompare(right.receiptHash));
      candidate.failureReceiptsHash = hashCanonicalJson(candidate.failureReceipts);
    }
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
      candidate.projectionStatus === "static_contract_projected"
      && candidate.actionInputMappings.length > 0)!;
    assert.equal(withInputs.projectionStatus, "static_contract_projected");
    if (withInputs.projectionStatus !== "static_contract_projected") return;
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
    assert.equal(accessibility.selectorElementRef, null);
    assert.equal(accessibility.ownerKind, "surface");

    const reproduced = verifyStitchRenderedSemanticsV3({
      ...input,
      renderedSemantics: produced.renderedSemantics,
    });
    assert.equal(reproduced.status, "reproduced_unverified_browser_cas", JSON.stringify(reproduced.diagnostics));
    if (reproduced.status === "rejected") return;
    assert.deepEqual(reproduced.renderedSemantics, produced.renderedSemantics);
    assert.notStrictEqual(reproduced.renderedSemantics, produced.renderedSemantics);
  });

  it("records static mapping failures as typed candidate-local receipts", () => {
    for (const [options, expectedCode, expectedPhase] of [
      [
        { duplicateControl: true },
        "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_DUPLICATE",
        "control_mapping",
      ],
      [
        { omitFirstInput: true },
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_MISSING",
        "action_input_mapping",
      ],
      [
        { wrongFirstCodec: true },
        "RENDERED_SEMANTICS_V3_ACTION_INPUT_CODEC_MISMATCH",
        "action_input_mapping",
      ],
    ] as const) {
      const input = fixture(options);
      const produced = produceStitchRenderedSemanticsV3(input);
      assert.equal(produced.status, "produced_unverified_browser_cas", JSON.stringify(produced.diagnostics));
      if (produced.status === "rejected") continue;
      const outcome = produced.renderedSemantics.candidates.find((candidate) =>
        candidate.projectionStatus === "static_source_rejected"
        && candidate.failureReceipts.some((receipt) => receipt.code === expectedCode));
      assert.ok(outcome);
      assert.equal(outcome.projectionStatus, "static_source_rejected");
      if (outcome.projectionStatus !== "static_source_rejected") continue;
      const receipt = outcome.failureReceipts.find((candidate) =>
        candidate.code === expectedCode)!;
      assert.equal(receipt.phase, expectedPhase);
      assert.ok(receipt.semanticRefs.some((reference) => reference.kind === "target"));
      assert.deepEqual(
        receipt.sourceRefs.filter((reference) => reference.kind !== "source_element")
          .map((reference) => reference.kind),
        ["html_source", "screenshot_source"],
      );
      assert.equal(outcome.failureReceiptsHash, hashCanonicalJson(outcome.failureReceipts));
      const reproduced = verifyStitchRenderedSemanticsV3({
        ...input,
        renderedSemantics: produced.renderedSemantics,
      });
      assert.equal(reproduced.status, "reproduced_unverified_browser_cas");
    }
  });

  it("keeps marker-shaped semantic identities separate from exact source elements", () => {
    for (const attack of [
      {
        markup: '<section data-surface-id="S000001"></section>',
        code: "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_EXTRA",
        semanticRefs: [{ kind: "surface", ref: "S000001" }],
      },
      {
        markup: '<button data-action="S000001">Spoofed action marker</button>',
        code: "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_EXTRA",
        semanticRefs: [{ kind: "action", ref: "S000001" }],
      },
      {
        markup: [
          '<input data-action-input-slot="S000001"',
          ' data-action-input="S000001"',
          ' data-action-input-codec="json-string.v1">',
        ].join(""),
        code: "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_EXTRA",
        semanticRefs: [
          { kind: "action_input", ref: "S000001" },
          { kind: "control_slot", ref: "S000001" },
        ],
      },
    ] as const) {
      const attacked = withFirstHtmlTransform(fixture(), (html) =>
        html.replace("</body>", `${attack.markup}</body>`));
      const receipt = staticFailureReceipt(attacked, attack.code);
      assert.deepEqual(
        receipt.semanticRefs.filter((reference) => reference.kind !== "target"),
        attack.semanticRefs,
      );
      const sourceElements = receipt.sourceRefs.filter((reference) =>
        reference.kind === "source_element");
      assert.equal(sourceElements.length, 1);
      assert.match(sourceElements[0]!.ref, /^S[0-9]{6}$/);
      assert.notEqual(
        sourceElements[0]!.ref,
        "S000001",
        "semantic marker text must never be reclassified as a source-element ref",
      );
    }
  });

  it("binds complete semantic and exact element provenance for mapping failures", () => {
    const duplicateControlInput = fixture({ duplicateControl: true });
    const duplicateControl = staticFailureReceipt(
      duplicateControlInput,
      "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_DUPLICATE",
    );
    const duplicateControlTarget = duplicateControlInput.generationTargets.targets.find(
      (target) => target.targetId === duplicateControl.targetRef,
    )!;
    const duplicatePlacement = duplicateControlTarget.requiredControlPlacements[0]!;
    assert.deepEqual(
      duplicateControl.semanticRefs.filter((reference) => reference.kind !== "target"),
      [
        { kind: "action", ref: duplicatePlacement.actionRef },
        { kind: "control_slot", ref: duplicatePlacement.controlSlotRef },
      ],
    );
    assert.equal(duplicateControl.sourceRefs.filter((reference) =>
      reference.kind === "source_element").length, 2);

    const duplicateInputFixture = fixture({ duplicateFirstInput: true });
    const duplicateInput = staticFailureReceipt(
      duplicateInputFixture,
      "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_DUPLICATE",
    );
    const duplicateInputTarget = duplicateInputFixture.generationTargets.targets.find(
      (target) => target.targetId === duplicateInput.targetRef,
    )!;
    const duplicateInputPlacement = duplicateInputTarget.requiredControlPlacements[0]!;
    const duplicateTransport = duplicateInputPlacement.actionInputTransports[0]!;
    assert.deepEqual(
      duplicateInput.semanticRefs.filter((reference) => reference.kind !== "target"),
      [
        { kind: "action", ref: duplicateTransport.actionRef },
        { kind: "action_input", ref: duplicateTransport.actionInputRef },
        { kind: "control_slot", ref: duplicateInputPlacement.controlSlotRef },
      ],
    );
    assert.equal(duplicateInput.sourceRefs.filter((reference) =>
      reference.kind === "source_element").length, 2);

    const missingInputFixture = fixture({ omitFirstInput: true });
    const missingInput = staticFailureReceipt(
      missingInputFixture,
      "RENDERED_SEMANTICS_V3_ACTION_INPUT_MAPPING_MISSING",
    );
    const missingInputTarget = missingInputFixture.generationTargets.targets.find(
      (target) => target.targetId === missingInput.targetRef,
    )!;
    const missingInputPlacement = missingInputTarget.requiredControlPlacements[0]!;
    const missingTransport = missingInputPlacement.actionInputTransports[0]!;
    assert.deepEqual(
      missingInput.semanticRefs.filter((reference) => reference.kind !== "target"),
      [
        { kind: "action", ref: missingTransport.actionRef },
        { kind: "action_input", ref: missingTransport.actionInputRef },
        { kind: "control_slot", ref: missingInputPlacement.controlSlotRef },
      ],
    );
    assert.equal(missingInput.sourceRefs.some((reference) =>
      reference.kind === "source_element"), false);

    const invalidInputFixture = fixture({ wrongFirstCodec: true });
    const invalidInput = staticFailureReceipt(
      invalidInputFixture,
      "RENDERED_SEMANTICS_V3_ACTION_INPUT_CODEC_MISMATCH",
    );
    assert.equal(invalidInput.sourceRefs.filter((reference) =>
      reference.kind === "source_element").length, 1);
    assert.deepEqual(
      invalidInput.semanticRefs.filter((reference) => reference.kind !== "target")
        .map((reference) => reference.kind),
      ["action", "action_input", "control_slot"],
    );
  });

  it("binds every duplicate contract element within the semantic DOM bound", () => {
    const duplicateMarkup = Array.from({ length: 101 }, () =>
      '<button data-action="S000001" data-action="S000001">Duplicate</button>')
      .join("");
    const attacked = withFirstHtmlTransform(fixture(), (html) =>
      html.replace("</body>", `${duplicateMarkup}</body>`));
    const receipt = staticFailureReceipt(
      attacked,
      "RENDERED_SEMANTICS_V3_CONTRACT_ATTRIBUTE_DUPLICATE",
    );
    assert.deepEqual(
      receipt.semanticRefs.filter((reference) => reference.kind !== "target"),
      [{ kind: "contract_attribute", ref: "data-action" }],
    );
    const sourceElements = receipt.sourceRefs.filter((reference) =>
      reference.kind === "source_element");
    const exactSourceElementRefs = parseStitchSemanticDomV1(
      Buffer.from(attacked.artifacts[0]!.htmlBytes).toString("utf8"),
    ).flatMap((element, sourceOrdinal) =>
      element.duplicateAttributes.includes("data-action")
        ? [`S${String(sourceOrdinal + 1).padStart(6, "0")}`]
        : []);
    assert.equal(receipt.sourceElementRefCount, 101);
    assert.equal(
      receipt.sourceElementRefsHash,
      hashCanonicalJson(exactSourceElementRefs),
    );
    assert.equal(
      sourceElements.length,
      STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3,
    );
    assert.equal(
      new Set(sourceElements.map((reference) => reference.ref)).size,
      STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3,
    );
    assert.deepEqual(
      sourceElements.map((reference) => reference.ref),
      exactSourceElementRefs.slice(
        0,
        STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3,
      ),
    );
  });

  it("bounds a large duplicate witness without aborting its good sibling", () => {
    const input = withHighDuplicateControlSibling(fixture());
    const produced = produceStitchRenderedSemanticsV3(input);
    assert.equal(
      produced.status,
      "produced_unverified_browser_cas",
      JSON.stringify(produced.diagnostics),
    );
    if (produced.status === "rejected") return;
    const bad = produced.renderedSemantics.candidates.find((candidate) =>
      candidate.screenId === "a-high-duplicate-control-sibling");
    const good = produced.renderedSemantics.candidates.find((candidate) =>
      candidate.requestRef === input.requests[0]!.requestRef
      && candidate.screenId === "provider-local-screen");
    assert.equal(bad?.projectionStatus, "static_source_rejected");
    assert.equal(good?.projectionStatus, "static_contract_projected");
    if (!bad || bad.projectionStatus !== "static_source_rejected") return;
    const receipt = bad.failureReceipts.find((candidate) =>
      candidate.code === "RENDERED_SEMANTICS_V3_CONTROL_MAPPING_DUPLICATE")!;
    const placement = input.generationTargets.targets[0]!
      .requiredControlPlacements[0]!;
    const artifact = input.artifacts.find((candidate) =>
      candidate.screenId === "a-high-duplicate-control-sibling")!;
    const exactSourceElementRefs = parseStitchSemanticDomV1(
      Buffer.from(artifact.htmlBytes).toString("utf8"),
    ).flatMap((element, sourceOrdinal) =>
      stitchSemanticAttribute(element, "data-control-slot")
          === placement.controlSlotRef
        && stitchSemanticAttribute(element, "data-action") === placement.actionRef
        ? [`S${String(sourceOrdinal + 1).padStart(6, "0")}`]
        : []);
    assert.equal(exactSourceElementRefs.length, 101);
    assert.equal(receipt.sourceElementRefCount, 101);
    assert.equal(receipt.sourceElementRefsHash, hashCanonicalJson(exactSourceElementRefs));
    assert.deepEqual(
      receipt.sourceRefs.filter((reference) => reference.kind === "source_element")
        .map((reference) => reference.ref),
      exactSourceElementRefs.slice(
        0,
        STITCH_RENDERED_STATIC_FAILURE_SOURCE_WITNESS_LIMIT_V3,
      ),
    );
    const reproduced = verifyStitchRenderedSemanticsV3({
      ...input,
      renderedSemantics: produced.renderedSemantics,
    });
    assert.equal(reproduced.status, "reproduced_unverified_browser_cas");
  });

  it("records missing and duplicate surface ownership without aborting the artifact", () => {
    for (const [options, expectedCode] of [
      [
        { duplicateRootSurface: true },
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_DUPLICATE",
      ],
      [
        { omitFirstContainedSurface: true },
        "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_MISSING",
      ],
    ] as const) {
      const produced = produceStitchRenderedSemanticsV3(fixture(options));
      assert.equal(produced.status, "produced_unverified_browser_cas", JSON.stringify(produced.diagnostics));
      if (produced.status === "rejected") continue;
      assert.ok(produced.renderedSemantics.candidates.some((candidate) =>
        candidate.projectionStatus === "static_source_rejected"
        && candidate.failureReceipts.some((receipt) => receipt.code === expectedCode)));
    }
  });

  it("continues after a bad sibling and emits every admitted candidate outcome", () => {
    const input = withBadAndGoodSibling(fixture());
    const produced = produceStitchRenderedSemanticsV3(input);
    assert.equal(produced.status, "produced_unverified_browser_cas", JSON.stringify(produced.diagnostics));
    if (produced.status === "rejected") return;
    assert.equal(produced.renderedSemantics.candidates.length, 3);
    const siblingOutcomes = produced.renderedSemantics.candidates
      .filter((candidate) => candidate.requestRef === input.requests[0]!.requestRef)
      .map((candidate) => [candidate.screenId, candidate.projectionStatus]);
    assert.deepEqual(
      siblingOutcomes,
      [
        ["a-static-bad-sibling", "static_source_rejected"],
        ["provider-local-screen", "static_contract_projected"],
      ],
    );
    const identities = produced.renderedSemantics.candidates.map((candidate) =>
      `${candidate.requestRef}\0${candidate.screenId}`);
    assert.deepEqual(identities, [...identities].sort());
  });

  it("emits an artifact when every admitted candidate is statically rejected", () => {
    const input = withAllAdmittedBad(fixture());
    const produced = produceStitchRenderedSemanticsV3(input);
    assert.equal(produced.status, "produced_unverified_browser_cas", JSON.stringify(produced.diagnostics));
    if (produced.status === "rejected") return;
    assert.equal(produced.renderedSemantics.candidates.length, 2);
    assert.ok(produced.renderedSemantics.candidates.every((candidate) =>
      candidate.projectionStatus === "static_source_rejected"));
  });

  it("allows target operations and complete evidence with zero admitted outcomes", () => {
    const oneExcluded = fixture({ excludeSecondTarget: true });
    const oneProduced = produceStitchRenderedSemanticsV3(oneExcluded);
    assert.equal(oneProduced.status, "produced_unverified_browser_cas", JSON.stringify(oneProduced.diagnostics));
    if (oneProduced.status === "rejected") return;
    assert.equal(oneProduced.renderedSemantics.candidates.length, 1);
    assert.equal(
      oneProduced.renderedSemantics.candidates.some((candidate) =>
        candidate.requestRef === oneExcluded.requests[1]!.requestRef),
      false,
    );

    const noneAdmitted = withoutAnyAdmission(fixture());
    const noneProduced = produceStitchRenderedSemanticsV3(noneAdmitted);
    assert.equal(noneProduced.status, "produced_unverified_browser_cas", JSON.stringify(noneProduced.diagnostics));
    if (noneProduced.status === "rejected") return;
    assert.deepEqual(noneProduced.renderedSemantics.candidates, []);
    assert.equal(noneProduced.renderedSemantics.candidatesHash, hashCanonicalJson([]));
  });

  it("projects accessibility query authority without claiming a static selector element", () => {
    const input = fixture({ implicitAccessibility: true });
    const produced = produceStitchRenderedSemanticsV3(input);
    assert.equal(produced.status, "produced_unverified_browser_cas", JSON.stringify(produced.diagnostics));
    if (produced.status === "rejected") return;
    assert.ok(produced.renderedSemantics.candidates.every((candidate) =>
      candidate.projectionStatus === "static_contract_projected"));
    for (const candidate of produced.renderedSemantics.candidates) {
      if (candidate.projectionStatus !== "static_contract_projected") continue;
      for (const mapping of candidate.observableMappings.filter((observable) =>
        observable.selectorKind === "accessibility")) {
        assert.equal(mapping.ownerKind, "surface");
        assert.equal(mapping.selectorElementRef, null);
        assert.ok(mapping.accessibilityRole);
        assert.ok(mapping.accessibilityName);
      }
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
    assert.equal(capacityRejected.status, "produced_unverified_browser_cas", JSON.stringify(capacityRejected.diagnostics));
    if (capacityRejected.status !== "rejected") {
      assert.ok(capacityRejected.renderedSemantics.candidates.some((candidate) =>
        candidate.projectionStatus === "static_source_rejected"
        && candidate.failureReceipts.some((receipt) =>
          receipt.code === "RENDERED_SEMANTICS_V3_ARTIFACT_CAPACITY_EXCEEDED")));
    }

    const invalidUtf8 = withFirstArtifactBytes(fixture(), {
      htmlBytes: Buffer.concat([
        validStitchHtml("<main>fatal utf8</main>", "invalid-utf8-v3"),
        Buffer.from([0xff]),
      ]),
    });
    const encodingRejected = produceStitchRenderedSemanticsV3(invalidUtf8);
    assert.equal(encodingRejected.status, "produced_unverified_browser_cas", JSON.stringify(encodingRejected.diagnostics));
    if (encodingRejected.status !== "rejected") {
      assert.ok(encodingRejected.renderedSemantics.candidates.some((candidate) =>
        candidate.projectionStatus === "static_source_rejected"
        && candidate.failureReceipts.some((receipt) =>
          receipt.code === "RENDERED_SEMANTICS_V3_HTML_ENCODING_INVALID")));
    }

    const tooManyElements = withFirstArtifactBytes(fixture(), {
      htmlBytes: validStitchHtml(
        "<i></i>".repeat(100_001),
        "semantic-element-capacity-v3",
      ),
    });
    const elementRejected = produceStitchRenderedSemanticsV3(tooManyElements);
    assert.equal(elementRejected.status, "produced_unverified_browser_cas", JSON.stringify(elementRejected.diagnostics));
    if (elementRejected.status !== "rejected") {
      assert.ok(elementRejected.renderedSemantics.candidates.some((candidate) =>
        candidate.projectionStatus === "static_source_rejected"
        && candidate.failureReceipts.some((receipt) =>
          receipt.code === "RENDERED_SEMANTICS_V3_ELEMENT_CAPACITY_EXCEEDED")));
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

  it("turns hostile artifact arrays, entries, and typed-array proxies into typed rejection", () => {
    const input = fixture();
    const produced = produceStitchRenderedSemanticsV3(input);
    assert.equal(produced.status, "produced_unverified_browser_cas");
    if (produced.status === "rejected") return;

    const hostileArray = new Proxy(input.artifacts.slice(), {
      getOwnPropertyDescriptor() {
        throw new Error("hostile artifact array descriptor");
      },
    });
    const hostileEntry = [
      new Proxy(input.artifacts[0]!, {
        ownKeys() {
          throw new Error("hostile artifact entry keys");
        },
      }),
      ...input.artifacts.slice(1),
    ];
    const hostileHtmlBytes = new Proxy(input.artifacts[0]!.htmlBytes, {
      get() {
        throw new Error("hostile typed-array property");
      },
    });
    const hostileTypedArray = [
      { ...input.artifacts[0]!, htmlBytes: hostileHtmlBytes },
      ...input.artifacts.slice(1),
    ];

    for (const artifacts of [hostileArray, hostileEntry, hostileTypedArray]) {
      let verified: ReturnType<typeof verifyStitchRenderedSemanticsV3> | undefined;
      assert.doesNotThrow(() => {
        verified = verifyStitchRenderedSemanticsV3({
          ...input,
          artifacts,
          renderedSemantics: produced.renderedSemantics,
        });
      });
      assert.equal(verified?.status, "rejected");
      if (verified?.status === "rejected") {
        assert.deepEqual(
          verified.rejectionCodes,
          ["RENDERED_SEMANTICS_V3_ARTIFACT_SET_INVALID"],
        );
      }
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

  it("requires exactly one HTML and screenshot authority per static failure receipt", () => {
    const produced = produceStitchRenderedSemanticsV3(fixture({ wrongFirstCodec: true }));
    assert.equal(produced.status, "produced_unverified_browser_cas");
    if (produced.status === "rejected") return;
    const forged = clone(produced.renderedSemantics);
    const rejected = forged.candidates.find((candidate) =>
      candidate.projectionStatus === "static_source_rejected");
    assert.ok(rejected);
    if (!rejected || rejected.projectionStatus !== "static_source_rejected") return;
    rejected.failureReceipts[0]!.sourceRefs.push({
      kind: "html_source",
      ref: "f".repeat(64),
    });
    rejected.failureReceipts[0]!.sourceRefs.sort((left, right) =>
      `${left.kind}\0${left.ref}`.localeCompare(`${right.kind}\0${right.ref}`));
    const parsed = StitchRenderedSemanticsV3Schema.safeParse(forged);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.ok(parsed.error.issues.some((issue) =>
        issue.message
          === "RENDERED_SEMANTICS_V3_STATIC_FAILURE_SOURCE_AUTHORITY_CARDINALITY_MISMATCH"));
    }
  });

  it("turns hostile root and nested property traps into typed parse rejection", () => {
    const input = fixture();
    const produced = produceStitchRenderedSemanticsV3(input);
    assert.equal(produced.status, "produced_unverified_browser_cas");
    if (produced.status === "rejected") return;
    const hostile = () => new Proxy({}, {
      get() {
        throw new Error("hostile get");
      },
      ownKeys() {
        throw new Error("hostile ownKeys");
      },
    });
    const nestedCandidate = clone(produced.renderedSemantics) as any;
    nestedCandidate.candidates = [hostile()];
    const nestedAuthority = clone(produced.renderedSemantics) as any;
    nestedAuthority.targetAuthorities = [hostile()];
    const nestedMapping = clone(produced.renderedSemantics) as any;
    nestedMapping.candidates[0].surfaceMappings = [hostile()];

    const rejectedInput = fixture({ wrongFirstCodec: true });
    const rejectedProduced = produceStitchRenderedSemanticsV3(rejectedInput);
    assert.equal(rejectedProduced.status, "produced_unverified_browser_cas");
    if (rejectedProduced.status === "rejected") return;
    const nestedReceipt = clone(rejectedProduced.renderedSemantics) as any;
    const rejectedCandidate = nestedReceipt.candidates.find((candidate: any) =>
      candidate.projectionStatus === "static_source_rejected");
    rejectedCandidate.failureReceipts = [hostile()];
    const nestedSourceRefs = clone(rejectedProduced.renderedSemantics) as any;
    const sourceRejectedCandidate = nestedSourceRefs.candidates.find((candidate: any) =>
      candidate.projectionStatus === "static_source_rejected");
    sourceRejectedCandidate.failureReceipts[0].sourceRefs = new Proxy([], {
      get() {
        throw new Error("hostile source refs");
      },
      ownKeys() {
        throw new Error("hostile source refs ownKeys");
      },
    });

    for (const value of [
      hostile(),
      nestedCandidate,
      nestedAuthority,
      nestedMapping,
      nestedReceipt,
      nestedSourceRefs,
    ]) {
      let parsed: ReturnType<typeof parseStitchRenderedSemanticsV3> | undefined;
      assert.doesNotThrow(() => {
        parsed = parseStitchRenderedSemanticsV3(value);
      });
      assert.equal(parsed?.status, "rejected");
    }

    const verified = verifyStitchRenderedSemanticsV3({
      ...input,
      renderedSemantics: hostile(),
    });
    assert.equal(verified.status, "rejected");
    if (verified.status === "rejected") {
      assert.deepEqual(
        verified.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_REPRODUCTION_INPUT_INVALID"],
      );
    }
  });

  it("rejects fully rehashed omitted and extra admitted-candidate outcomes", () => {
    const input = fixture();
    const produced = produceStitchRenderedSemanticsV3(input);
    assert.equal(produced.status, "produced_unverified_browser_cas");
    if (produced.status === "rejected") return;

    const omitted = clone(produced.renderedSemantics);
    omitted.candidates.splice(0, 1);
    rehashRenderedSemantics(omitted);
    assert.equal(StitchRenderedSemanticsV3Schema.safeParse(omitted).success, true);

    const extra = clone(produced.renderedSemantics);
    const injected = clone(extra.candidates[0]!);
    injected.screenId = "caller-injected-extra-screen";
    extra.candidates.push(injected);
    extra.candidates.sort((left, right) => {
      const leftKey = `${left.requestRef}\0${left.screenId}`;
      const rightKey = `${right.requestRef}\0${right.screenId}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
    rehashRenderedSemantics(extra);
    assert.equal(StitchRenderedSemanticsV3Schema.safeParse(extra).success, true);

    for (const renderedSemantics of [omitted, extra]) {
      const verified = verifyStitchRenderedSemanticsV3({
        ...input,
        renderedSemantics,
      });
      assert.equal(verified.status, "rejected");
      if (verified.status === "rejected") {
        assert.deepEqual(
          verified.rejectionCodes,
          ["RENDERED_SEMANTICS_V3_AUTHORITY_MISMATCH"],
        );
      }
    }
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

    const rejectedInput = withAllAdmittedBad(fixture());
    const rejectedProduced = produceStitchRenderedSemanticsV3(rejectedInput);
    assert.equal(rejectedProduced.status, "produced_unverified_browser_cas", JSON.stringify(rejectedProduced.diagnostics));
    if (rejectedProduced.status === "rejected") return;
    const rejectedForgery = clone(rejectedProduced.renderedSemantics);
    const rejectedCandidate = rejectedForgery.candidates.find((candidate) =>
      candidate.projectionStatus === "static_source_rejected");
    assert.ok(rejectedCandidate);
    if (rejectedCandidate.projectionStatus !== "static_source_rejected") return;
    rejectedCandidate.failureReceipts[0]!.code =
      "RENDERED_SEMANTICS_V3_SURFACE_MAPPING_DUPLICATE";
    rehashRenderedSemantics(rejectedForgery);
    assert.equal(StitchRenderedSemanticsV3Schema.safeParse(rejectedForgery).success, true);
    const rejectedReceiptForgery = verifyStitchRenderedSemanticsV3({
      ...rejectedInput,
      renderedSemantics: rejectedForgery,
    });
    assert.equal(rejectedReceiptForgery.status, "rejected");
    if (rejectedReceiptForgery.status === "rejected") {
      assert.deepEqual(
        rejectedReceiptForgery.rejectionCodes,
        ["RENDERED_SEMANTICS_V3_AUTHORITY_MISMATCH"],
      );
    }
  });
});
