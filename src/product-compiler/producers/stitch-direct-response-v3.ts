import { createHash } from "node:crypto";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import { canonicalDesignSourceGenerationPromptV2 } from "../design-source-compilation-attempt-runner.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import { Sha256Schema } from "../schemas/common-v1.js";
import {
  DESIGN_SOURCE_GENERATION_DISPATCH_RECEIPT_ARTIFACT_TYPE_V3,
  DESIGN_SOURCE_GENERATION_REQUEST_ARTIFACT_TYPE_V3,
  DesignSourceGenerationDispatchReceiptV3Schema,
  DesignSourceGenerationRequestV3Schema,
  DesignSourceGenerationRetryIdentityV3Schema,
  designSourceGenerationRequestRefV3,
  hashDesignSourceGenerationAuthorityBindingV3,
  hashDesignSourceGenerationDispatchReceiptV3,
  hashDesignSourceGenerationRequestReceiptV3,
  type DesignSourceGenerationDispatchReceiptV3,
  type DesignSourceGenerationRequestCoreV3,
  type DesignSourceGenerationRequestV3,
} from "../schemas/design-source-generation-request-v3.js";
import {
  type DesignGenerationTargetsV3,
} from "../schemas/design-generation-targets-v3.js";
import {
  DesignSourceGenerationAuthorityV1Schema,
  type DesignSourceGenerationAuthorityV1,
} from "../schemas/design-source-generation-authority-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";
import { verifyDesignGenerationTargetsV3 } from "./design-targets-v3.js";
import {
  STITCH_DIRECT_RESPONSE_EVIDENCE_ARTIFACT_TYPE_V3,
  StitchDirectProviderResponseV3Schema,
  StitchDirectResponseEvidenceV3Schema,
  hashStitchDirectResponseEvidenceV3,
  hashStitchDirectResponseOperationV3,
  hashStitchDirectScreenEvidenceV3,
  stitchDirectScreenSourceEvidenceHashV3,
  type StitchDirectProviderResponseV3,
  type StitchDirectResponseEvidenceV3,
  type StitchDirectResponseOperationV3,
  type StitchDirectScreenEvidenceV3,
} from "../schemas/stitch-direct-response-evidence-v3.js";

export type StitchDirectResponseIdentityDiagnosticCodeV3 =
  | "DESIGN_REQUEST_V3_GENERATION_TARGETS_INVALID"
  | "DESIGN_REQUEST_V3_TARGET_CARDINALITY_INVALID"
  | "DESIGN_REQUEST_V3_TARGET_UNRESOLVED"
  | "DESIGN_REQUEST_V3_PROMPT_INVALID"
  | "DESIGN_REQUEST_V3_RETRY_NOT_SUPPORTED"
  | "DESIGN_REQUEST_V3_GENERATION_AUTHORITY_INVALID"
  | "DESIGN_REQUEST_V3_GENERATION_AUTHORITY_MISMATCH"
  | "DESIGN_DISPATCH_V3_REQUEST_INVALID"
  | "DESIGN_DISPATCH_V3_EXTERNAL_OPERATION_ID_INVALID"
  | "DESIGN_DISPATCH_V3_AUTHORITY_INVALID"
  | "DESIGN_DISPATCH_V3_AUTHORITY_MISMATCH"
  | "DESIGN_DISPATCH_V3_OUTPUT_INVALID"
  | "DESIGN_REQUEST_V3_OUTPUT_INVALID"
  | "DIRECT_RESPONSE_V3_GENERATION_TARGETS_INVALID"
  | "DIRECT_RESPONSE_V3_GENERATION_AUTHORITY_INVALID"
  | "DIRECT_RESPONSE_V3_GENERATION_AUTHORITY_MISMATCH"
  | "DIRECT_RESPONSE_V3_REQUEST_INVALID"
  | "DIRECT_RESPONSE_V3_REQUEST_TARGET_MISMATCH"
  | "DIRECT_RESPONSE_V3_REQUEST_SET_INCOMPLETE"
  | "DIRECT_RESPONSE_V3_DISPATCH_RECEIPT_INVALID"
  | "DIRECT_RESPONSE_V3_DISPATCH_RECEIPT_SET_INVALID"
  | "DIRECT_RESPONSE_V3_RAW_RESPONSE_SET_INVALID"
  | "DIRECT_RESPONSE_V3_PROVIDER_RESPONSE_INVALID"
  | "DIRECT_RESPONSE_V3_OUTPUT_INVALID"
  | "DIRECT_RESPONSE_V3_VERIFICATION_INPUT_INVALID"
  | "DIRECT_RESPONSE_V3_AUTHORITY_MISMATCH";

type Rejected = Readonly<{
  status: "rejected";
  rejectionCodes: StitchDirectResponseIdentityDiagnosticCodeV3[];
  diagnostics: CompilationDiagnosticV1[];
}>;

export type DesignSourceGenerationRequestResultV3 =
  | Readonly<{
      status: "produced";
      request: DesignSourceGenerationRequestV3;
      diagnostics: readonly [];
    }>
  | Rejected;

export type DesignSourceGenerationDispatchReceiptResultV3 =
  | Readonly<{
      status: "produced";
      dispatchReceipt: DesignSourceGenerationDispatchReceiptV3;
      diagnostics: readonly [];
    }>
  | Rejected;

export type StitchDirectResponseEvidenceResultV3 =
  | Readonly<{
      status: "produced";
      directResponseEvidence: StitchDirectResponseEvidenceV3;
      diagnostics: readonly [];
    }>
  | Rejected;

export type StitchDirectResponseEvidenceVerificationResultV3 =
  | Readonly<{
      status: "verified";
      directResponseEvidence: StitchDirectResponseEvidenceV3;
      diagnostics: readonly [];
    }>
  | Rejected;

export type BoundStitchDirectProviderResponseV3 = Readonly<{
  requestRef: string;
  rawTransportArtifactHash: string;
  response: unknown;
}>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function diagnostic(
  code: StitchDirectResponseIdentityDiagnosticCodeV3,
  message: string,
  reference?: string,
): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code,
    category: "execution_identity",
    severity: "error",
    message: message.slice(0, 2_000),
    ...(reference ? { reference: reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(...diagnosticsInput: CompilationDiagnosticV1[]): Rejected {
  const diagnostics = sortCompilationDiagnostics(diagnosticsInput);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(diagnostics.map((item) =>
      item.code as StitchDirectResponseIdentityDiagnosticCodeV3)),
    diagnostics,
  };
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return `${issue?.path.join("/") || "$"}: ${issue?.message || "schema mismatch"}`;
}

function verifyGenerationTargets(
  productSpecInput: unknown,
  generationTargetsInput: unknown,
  code: Extract<
    StitchDirectResponseIdentityDiagnosticCodeV3,
    "DESIGN_REQUEST_V3_GENERATION_TARGETS_INVALID" | "DIRECT_RESPONSE_V3_GENERATION_TARGETS_INVALID"
  >,
): Readonly<{
  productSpec: ProductSpecV2;
  generationTargets: DesignGenerationTargetsV3;
}> | Rejected {
  const verified = verifyDesignGenerationTargetsV3({
    productSpec: productSpecInput,
    generationTargets: generationTargetsInput,
  });
  if (verified.status === "rejected") {
    return reject(diagnostic(
      code,
      `DesignGenerationTargetsV3 failed exact ProductSpecV2 authority verification: ${verified.rejectionCodes.join(",")}`,
      "generationTargets",
    ));
  }
  return {
    productSpec: ProductSpecV2Schema.parse(productSpecInput),
    generationTargets: verified.generationTargets,
  };
}

function parseGenerationAuthority(
  input: unknown,
  invalidCode: Extract<
    StitchDirectResponseIdentityDiagnosticCodeV3,
    | "DESIGN_REQUEST_V3_GENERATION_AUTHORITY_INVALID"
    | "DESIGN_DISPATCH_V3_AUTHORITY_INVALID"
    | "DIRECT_RESPONSE_V3_GENERATION_AUTHORITY_INVALID"
  >,
): DesignSourceGenerationAuthorityV1 | Rejected {
  const parsed = DesignSourceGenerationAuthorityV1Schema.safeParse(input);
  if (!parsed.success) {
    return reject(diagnostic(
      invalidCode,
      `Source-generation authority failed at ${firstIssue(parsed.error)}`,
      "generationAuthority",
    ));
  }
  return parsed.data;
}

function generationAuthorityBinding(authority: DesignSourceGenerationAuthorityV1) {
  return {
    authority,
    authorityHash: hashDesignSourceGenerationAuthorityBindingV3(authority),
  };
}

function generationAuthorityMatchesSources(input: Readonly<{
  authority: DesignSourceGenerationAuthorityV1;
  productSpec: ProductSpecV2;
  generationTargets: DesignGenerationTargetsV3;
}>): boolean {
  const targetRefs = input.generationTargets.targets
    .map((target) => target.targetId)
    .sort(compareUtf16);
  return input.authority.productSpecHash === hashCanonicalJson(input.productSpec)
    && input.authority.generationTargetsHash === hashCanonicalJson(input.generationTargets)
    && canonicalJsonStringify(input.authority.targetRefs)
      === canonicalJsonStringify(targetRefs);
}

function canonicalPromptHash(promptInput: unknown): string | undefined {
  if (typeof promptInput !== "string") return undefined;
  try {
    return canonicalDesignSourceGenerationPromptV2(promptInput).promptHash;
  } catch {
    return undefined;
  }
}

/**
 * Creates one compiler-owned request receipt for exactly one generation target.
 * Raw prompt and provider-operation identity never enter the serialized receipt.
 */
export function produceDesignSourceGenerationRequestV3(input: Readonly<{
  productSpec: unknown;
  generationTargets: unknown;
  generationAuthority: unknown;
  targetRefs: readonly string[];
  ordinal: 1 | 2;
  retryAuthority: unknown;
  prompt: unknown;
}>): DesignSourceGenerationRequestResultV3 {
  const verifiedSources = verifyGenerationTargets(
    input.productSpec,
    input.generationTargets,
    "DESIGN_REQUEST_V3_GENERATION_TARGETS_INVALID",
  );
  if ("status" in verifiedSources) return verifiedSources;
  const { productSpec, generationTargets } = verifiedSources;
  const generationAuthority = parseGenerationAuthority(
    input.generationAuthority,
    "DESIGN_REQUEST_V3_GENERATION_AUTHORITY_INVALID",
  );
  if ("status" in generationAuthority) return generationAuthority;
  if (!generationAuthorityMatchesSources({
    authority: generationAuthority,
    productSpec,
    generationTargets,
  })) {
    return reject(diagnostic(
      "DESIGN_REQUEST_V3_GENERATION_AUTHORITY_MISMATCH",
      "Source-generation authority must bind the exact ProductSpecV2, verified GenerationTargetsV3, and canonical complete target set",
      "generationAuthority",
    ));
  }
  if (!Array.isArray(input.targetRefs) || input.targetRefs.length !== 1) {
    return reject(diagnostic(
      "DESIGN_REQUEST_V3_TARGET_CARDINALITY_INVALID",
      `One provider operation must own exactly one target; observed ${Array.isArray(input.targetRefs) ? input.targetRefs.length : "non-array"}`,
      "targetRefs",
    ));
  }
  const targetRef = input.targetRefs[0]!;
  const targetIndex = generationTargets.targets.findIndex((candidate) =>
    candidate.targetId === targetRef);
  if (targetIndex < 0) {
    return reject(diagnostic(
      "DESIGN_REQUEST_V3_TARGET_UNRESOLVED",
      `GenerationTargetsV3 has no target ${targetRef}`,
      targetRef,
    ));
  }
  const target = generationTargets.targets[targetIndex]!;
  const stageId = `DSGS_${String(targetIndex + 1).padStart(3, "0")}`;
  const retry = DesignSourceGenerationRetryIdentityV3Schema.safeParse({
    ordinal: input.ordinal,
    retryAuthority: input.retryAuthority,
  });
  if (!retry.success) {
    return reject(diagnostic(
      "DESIGN_REQUEST_V3_RETRY_NOT_SUPPORTED",
      `RequestV3 is initial-generation-only; retry requires a future delta/carry-forward authority instead of resending unchanged targets (${firstIssue(retry.error)})`,
      targetRef,
    ));
  }
  const promptHash = canonicalPromptHash(input.prompt);
  if (!promptHash) {
    return reject(diagnostic(
      "DESIGN_REQUEST_V3_PROMPT_INVALID",
      "The canonical provider prompt must be a non-empty UTF-8 string",
      stageId,
    ));
  }
  const core: DesignSourceGenerationRequestCoreV3 = {
    schema: DESIGN_SOURCE_GENERATION_REQUEST_ARTIFACT_TYPE_V3,
    generationTargetsPayloadHash: generationTargets.payloadHash,
    generationAuthorityHash: hashDesignSourceGenerationAuthorityBindingV3(
      generationAuthority,
    ),
    targetRef: target.targetId,
    targetHash: target.targetHash,
    requestScreenKey: target.requestScreenKey,
    stageId,
    retry: retry.data,
    promptHash,
  };
  const requestRef = designSourceGenerationRequestRefV3(core);
  const payload = { ...core, requestRef };
  const output = DesignSourceGenerationRequestV3Schema.safeParse({
    ...payload,
    receiptHash: hashDesignSourceGenerationRequestReceiptV3(payload),
  });
  if (!output.success) {
    return reject(diagnostic(
      "DESIGN_REQUEST_V3_OUTPUT_INVALID",
      `Request receipt failed at ${firstIssue(output.error)}`,
      stageId,
    ));
  }
  return { status: "produced", request: output.data, diagnostics: [] };
}

/** Seals the opaque provider operation identity only after dispatch exists. */
export function produceDesignSourceGenerationDispatchReceiptV3(input: Readonly<{
  request: unknown;
  dispatchedGenerationAuthority: unknown;
  externalOperationId: unknown;
}>): DesignSourceGenerationDispatchReceiptResultV3 {
  const request = DesignSourceGenerationRequestV3Schema.safeParse(input.request);
  if (!request.success) {
    return reject(diagnostic(
      "DESIGN_DISPATCH_V3_REQUEST_INVALID",
      `Dispatch request failed at ${firstIssue(request.error)}`,
      "request",
    ));
  }
  const dispatchedGenerationAuthority = parseGenerationAuthority(
    input.dispatchedGenerationAuthority,
    "DESIGN_DISPATCH_V3_AUTHORITY_INVALID",
  );
  if ("status" in dispatchedGenerationAuthority) {
    return dispatchedGenerationAuthority;
  }
  const dispatchedAuthorityBinding = generationAuthorityBinding(
    dispatchedGenerationAuthority,
  );
  if (
    dispatchedAuthorityBinding.authorityHash
      !== request.data.generationAuthorityHash
  ) {
    return reject(diagnostic(
      "DESIGN_DISPATCH_V3_AUTHORITY_MISMATCH",
      "Observed dispatch provider, model, device, prompt/render/selection policies, and producer release must equal the pre-dispatch request authority",
      request.data.requestRef,
    ));
  }
  if (
    typeof input.externalOperationId !== "string"
    || input.externalOperationId.length === 0
    || input.externalOperationId.length > 2_000
  ) {
    return reject(diagnostic(
      "DESIGN_DISPATCH_V3_EXTERNAL_OPERATION_ID_INVALID",
      "The opaque external operation identity must be a non-empty bounded string",
      request.data.requestRef,
    ));
  }
  const payload = {
    schema: DESIGN_SOURCE_GENERATION_DISPATCH_RECEIPT_ARTIFACT_TYPE_V3,
    requestRef: request.data.requestRef,
    requestReceiptHash: request.data.receiptHash,
    dispatchedGenerationAuthorityHash: dispatchedAuthorityBinding.authorityHash,
    externalOperationIdHash: sha256(Buffer.from(input.externalOperationId, "utf8")),
  };
  const output = DesignSourceGenerationDispatchReceiptV3Schema.safeParse({
    ...payload,
    dispatchReceiptHash: hashDesignSourceGenerationDispatchReceiptV3(payload),
  });
  if (!output.success) {
    return reject(diagnostic(
      "DESIGN_DISPATCH_V3_OUTPUT_INVALID",
      `Dispatch receipt failed at ${firstIssue(output.error)}`,
      request.data.requestRef,
    ));
  }
  return { status: "produced", dispatchReceipt: output.data, diagnostics: [] };
}

function validateRequestAuthority(input: Readonly<{
  generationTargets: DesignGenerationTargetsV3;
  generationAuthority: DesignSourceGenerationAuthorityV1;
  requests: readonly DesignSourceGenerationRequestV3[];
}>): Rejected | undefined {
  const targetByRef = new Map(input.generationTargets.targets.map((target) =>
    [target.targetId, target] as const));
  const targetIndexByRef = new Map(input.generationTargets.targets.map((target, index) =>
    [target.targetId, index] as const));
  const expectedTargetRefs = input.generationTargets.targets
    .map((target) => target.targetId)
    .sort(compareUtf16);
  const observedTargetRefs = input.requests.map((request) => request.targetRef).sort(compareUtf16);
  if (
    input.requests.length !== input.generationTargets.targets.length
    || new Set(observedTargetRefs).size !== observedTargetRefs.length
    || canonicalJsonStringify(observedTargetRefs) !== canonicalJsonStringify(expectedTargetRefs)
  ) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_REQUEST_SET_INCOMPLETE",
      "Request receipts must partition every and only GenerationTargetsV3 target exactly once",
      "requests",
    ));
  }
  const requestRefs = input.requests.map((request) => request.requestRef);
  const stageIds = input.requests.map((request) => request.stageId);
  const generationAuthorityHashes = input.requests.map((request) =>
    request.generationAuthorityHash);
  const retryIdentityHashes = input.requests.map((request) =>
    hashCanonicalJson(request.retry));
  const expectedGenerationAuthorityHash =
    hashDesignSourceGenerationAuthorityBindingV3(input.generationAuthority);
  if (
    new Set(requestRefs).size !== requestRefs.length
    || new Set(stageIds).size !== stageIds.length
    || new Set(generationAuthorityHashes).size !== 1
    || generationAuthorityHashes[0] !== expectedGenerationAuthorityHash
    || new Set(retryIdentityHashes).size !== 1
  ) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_REQUEST_INVALID",
      "Request refs and stage IDs must be globally unique and all requests must share the supplied source-generation and typed retry authorities",
      "requests",
    ));
  }
  for (const request of input.requests) {
    const target = targetByRef.get(request.targetRef);
    const targetIndex = targetIndexByRef.get(request.targetRef);
    if (
      !target
      || targetIndex === undefined
      || request.generationTargetsPayloadHash !== input.generationTargets.payloadHash
      || request.targetHash !== target.targetHash
      || request.requestScreenKey !== target.requestScreenKey
      || request.stageId
        !== `DSGS_${String(targetIndex + 1).padStart(3, "0")}`
    ) {
      return reject(diagnostic(
        "DIRECT_RESPONSE_V3_REQUEST_TARGET_MISMATCH",
        `Request ${request.requestRef} does not equal its exact GenerationTargetsV3 target authority`,
        request.targetRef,
      ));
    }
  }
  return undefined;
}

function canonicalCandidate(input: Readonly<{
  request: DesignSourceGenerationRequestV3;
  dispatchReceipt: DesignSourceGenerationDispatchReceiptV3;
  screen: StitchDirectProviderResponseV3["screens"][number];
}>): StitchDirectScreenEvidenceV3 {
  const responsePaths = [...input.screen.responsePaths].sort(compareUtf16);
  const source = {
    screenId: input.screen.screenId,
    title: input.screen.title,
    responsePaths,
    htmlAvailable: input.screen.htmlAvailable,
    screenshotAvailable: input.screen.screenshotAvailable,
    htmlSourceRefHash: input.screen.htmlSourceRefHash,
    screenshotSourceRefHash: input.screen.screenshotSourceRefHash,
    htmlDownloadedArtifactHash: input.screen.htmlDownloadedArtifactHash,
    screenshotDownloadedArtifactHash: input.screen.screenshotDownloadedArtifactHash,
  };
  const missingEvidence = [
    ...(!source.htmlAvailable ? ["html" as const] : []),
    ...(!source.screenshotAvailable ? ["screenshot" as const] : []),
  ];
  const missingDownloadedEvidence = [
    ...(source.htmlAvailable && source.htmlDownloadedArtifactHash === null
      ? ["html" as const]
      : []),
    ...(source.screenshotAvailable && source.screenshotDownloadedArtifactHash === null
      ? ["screenshot" as const]
      : []),
  ];
  const payload = {
    requestRef: input.request.requestRef,
    requestReceiptHash: input.request.receiptHash,
    dispatchReceiptHash: input.dispatchReceipt.dispatchReceiptHash,
    generationAuthorityHash: input.request.generationAuthorityHash,
    stageId: input.request.stageId,
    targetRef: input.request.targetRef,
    targetHash: input.request.targetHash,
    requestScreenKey: input.request.requestScreenKey,
    ...source,
    missingEvidence,
    missingDownloadedEvidence,
    disposition: missingEvidence.length > 0
      ? "excluded_missing_render_evidence" as const
      : missingDownloadedEvidence.length > 0
        ? "excluded_download_failure" as const
        : "admitted_renderable_screen" as const,
    sourceEvidenceHash: stitchDirectScreenSourceEvidenceHashV3(source),
  };
  return StitchDirectResponseEvidenceV3Schema.shape.operations.element.shape.candidates.element.parse({
    ...payload,
    candidateHash: hashStitchDirectScreenEvidenceV3(payload),
  });
}

function canonicalOperation(input: Readonly<{
  request: DesignSourceGenerationRequestV3;
  dispatchReceipt: DesignSourceGenerationDispatchReceiptV3;
  rawTransportArtifactHash: string;
  response: StitchDirectProviderResponseV3;
}>): StitchDirectResponseOperationV3 {
  const candidates = input.response.screens
    .map((screen) => canonicalCandidate({
      request: input.request,
      dispatchReceipt: input.dispatchReceipt,
      screen,
    }))
    .sort((left, right) => compareUtf16(left.screenId, right.screenId));
  const payload = {
    request: input.request,
    dispatchReceipt: input.dispatchReceipt,
    rawTransportArtifactHash: input.rawTransportArtifactHash,
    providerResponseProjectionHash: hashCanonicalJson(input.response),
    candidates,
    candidatesHash: hashCanonicalJson(candidates),
  };
  return StitchDirectResponseEvidenceV3Schema.shape.operations.element.parse({
    ...payload,
    operationHash: hashStitchDirectResponseOperationV3(payload),
  });
}

/**
 * Joins strict provider output to target identity exclusively through exact
 * compiler-owned request receipts. Provider titles never participate in identity.
 */
export function produceStitchDirectResponseEvidenceV3(input: Readonly<{
  productSpec: unknown;
  generationTargets: unknown;
  generationAuthority: unknown;
  requests: readonly unknown[];
  dispatchReceipts: readonly unknown[];
  rawResponses: readonly BoundStitchDirectProviderResponseV3[];
}>): StitchDirectResponseEvidenceResultV3 {
  const verifiedSources = verifyGenerationTargets(
    input.productSpec,
    input.generationTargets,
    "DIRECT_RESPONSE_V3_GENERATION_TARGETS_INVALID",
  );
  if ("status" in verifiedSources) return verifiedSources;
  const { productSpec, generationTargets } = verifiedSources;
  const generationAuthority = parseGenerationAuthority(
    input.generationAuthority,
    "DIRECT_RESPONSE_V3_GENERATION_AUTHORITY_INVALID",
  );
  if ("status" in generationAuthority) return generationAuthority;
  if (!generationAuthorityMatchesSources({
    authority: generationAuthority,
    productSpec,
    generationTargets,
  })) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_GENERATION_AUTHORITY_MISMATCH",
      "Source-generation authority must bind the exact ProductSpecV2, verified GenerationTargetsV3, and canonical complete target set",
      "generationAuthority",
    ));
  }
  const parsedRequests = z.array(DesignSourceGenerationRequestV3Schema)
    .min(1).max(1_000).safeParse(input.requests);
  if (!parsedRequests.success) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_REQUEST_INVALID",
      `Request receipts failed at ${firstIssue(parsedRequests.error)}`,
      "requests",
    ));
  }
  const requestAuthorityFailure = validateRequestAuthority({
    generationTargets,
    generationAuthority,
    requests: parsedRequests.data,
  });
  if (requestAuthorityFailure) return requestAuthorityFailure;

  const parsedDispatchReceipts = z.array(DesignSourceGenerationDispatchReceiptV3Schema)
    .min(1).max(1_000).safeParse(input.dispatchReceipts);
  if (!parsedDispatchReceipts.success) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_DISPATCH_RECEIPT_INVALID",
      `Dispatch receipts failed at ${firstIssue(parsedDispatchReceipts.error)}`,
      "dispatchReceipts",
    ));
  }
  const requestByRef = new Map(parsedRequests.data.map((request) =>
    [request.requestRef, request] as const));
  const dispatchByRequest = new Map<string, DesignSourceGenerationDispatchReceiptV3>();
  for (const receipt of parsedDispatchReceipts.data) {
    const request = requestByRef.get(receipt.requestRef);
    if (
      !request
      || dispatchByRequest.has(receipt.requestRef)
      || receipt.requestReceiptHash !== request.receiptHash
      || receipt.dispatchedGenerationAuthorityHash
        !== request.generationAuthorityHash
    ) {
      return reject(diagnostic(
        "DIRECT_RESPONSE_V3_DISPATCH_RECEIPT_SET_INVALID",
        "Every exact request must own one and only one matching post-dispatch receipt",
        receipt.requestRef,
      ));
    }
    dispatchByRequest.set(receipt.requestRef, receipt);
  }
  if (
    dispatchByRequest.size !== requestByRef.size
    || [...requestByRef].some(([requestRef]) => !dispatchByRequest.has(requestRef))
  ) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_DISPATCH_RECEIPT_SET_INVALID",
      "Dispatch receipt refs must equal every and only exact request receipt",
      "dispatchReceipts",
    ));
  }

  if (
    !Array.isArray(input.rawResponses)
    || input.rawResponses.length < 1
    || input.rawResponses.length > 1_000
  ) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_RAW_RESPONSE_SET_INVALID",
      "Raw transport response bindings must contain between 1 and 1000 entries",
      "rawResponses",
    ));
  }
  const responseByRequest = new Map<string, Readonly<{
    response: StitchDirectProviderResponseV3;
    rawTransportArtifactHash: string;
  }>>();
  for (const bound of input.rawResponses) {
    if (
      !bound
      || typeof bound !== "object"
      || typeof bound.requestRef !== "string"
      || !Sha256Schema.safeParse(bound.rawTransportArtifactHash).success
      || responseByRequest.has(bound.requestRef)
    ) {
      return reject(diagnostic(
        "DIRECT_RESPONSE_V3_RAW_RESPONSE_SET_INVALID",
        "Every request must own exactly one compiler-bound raw response",
        "rawResponses",
      ));
    }
    const response = StitchDirectProviderResponseV3Schema.safeParse(bound.response);
    if (!response.success) {
      return reject(diagnostic(
        "DIRECT_RESPONSE_V3_PROVIDER_RESPONSE_INVALID",
        `Provider response for ${bound.requestRef} failed at ${firstIssue(response.error)}`,
        bound.requestRef,
      ));
    }
    responseByRequest.set(bound.requestRef, {
      response: response.data,
      rawTransportArtifactHash: bound.rawTransportArtifactHash,
    });
  }
  const requestRefs = new Set(parsedRequests.data.map((request) => request.requestRef));
  if (
    responseByRequest.size !== requestRefs.size
    || [...requestRefs].some((requestRef) => !responseByRequest.has(requestRef))
    || [...responseByRequest].some(([requestRef]) => !requestRefs.has(requestRef))
  ) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_RAW_RESPONSE_SET_INVALID",
      "Raw response refs must equal every and only exact request receipt",
      "rawResponses",
    ));
  }

  const operations = parsedRequests.data
    .map((request) => canonicalOperation({
      request,
      dispatchReceipt: dispatchByRequest.get(request.requestRef)!,
      rawTransportArtifactHash:
        responseByRequest.get(request.requestRef)!.rawTransportArtifactHash,
      response: responseByRequest.get(request.requestRef)!.response,
    }))
    .sort((left, right) => compareUtf16(left.request.targetRef, right.request.targetRef));
  const payload = {
    schema: STITCH_DIRECT_RESPONSE_EVIDENCE_ARTIFACT_TYPE_V3,
    generationTargetsPayloadHash: generationTargets.payloadHash,
    generationAuthority: generationAuthorityBinding(generationAuthority),
    requestsHash: hashCanonicalJson(operations.map((operation) => operation.request)),
    dispatchReceiptsHash: hashCanonicalJson(
      operations.map((operation) => operation.dispatchReceipt),
    ),
    operations,
    operationsHash: hashCanonicalJson(operations),
  };
  const output = StitchDirectResponseEvidenceV3Schema.safeParse({
    ...payload,
    payloadHash: hashStitchDirectResponseEvidenceV3(payload),
  });
  if (!output.success) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_OUTPUT_INVALID",
      `DirectResponseEvidenceV3 failed at ${firstIssue(output.error)}`,
      "directResponseEvidence",
    ));
  }
  return {
    status: "produced",
    directResponseEvidence: output.data,
    diagnostics: [],
  };
}

/**
 * Reproduces the exact response authority from immutable requests, one CAS-bound
 * raw transport artifact per request, and the strict compiler projection.
 */
export function verifyStitchDirectResponseEvidenceV3(input: Readonly<{
  productSpec: unknown;
  generationTargets: unknown;
  generationAuthority: unknown;
  requests: readonly unknown[];
  dispatchReceipts: readonly unknown[];
  rawResponses: readonly BoundStitchDirectProviderResponseV3[];
  directResponseEvidence: unknown;
}>): StitchDirectResponseEvidenceVerificationResultV3 {
  const actual = StitchDirectResponseEvidenceV3Schema.safeParse(input.directResponseEvidence);
  if (!actual.success) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_VERIFICATION_INPUT_INVALID",
      `Serialized response authority failed at ${firstIssue(actual.error)}`,
      "directResponseEvidence",
    ));
  }
  const reproduced = produceStitchDirectResponseEvidenceV3({
    productSpec: input.productSpec,
    generationTargets: input.generationTargets,
    generationAuthority: input.generationAuthority,
    requests: input.requests,
    dispatchReceipts: input.dispatchReceipts,
    rawResponses: input.rawResponses,
  });
  if (reproduced.status === "rejected") return reproduced;
  if (
    canonicalJsonStringify(actual.data)
      !== canonicalJsonStringify(reproduced.directResponseEvidence)
    || hashCanonicalJson(actual.data)
      !== hashCanonicalJson(reproduced.directResponseEvidence)
  ) {
    return reject(diagnostic(
      "DIRECT_RESPONSE_V3_AUTHORITY_MISMATCH",
      "DirectResponseEvidenceV3 is not the exact canonical projection of verified targets, parent authority, request/dispatch receipts, raw transport artifact hashes, and strict provider response projections",
      "directResponseEvidence",
    ));
  }
  return {
    status: "verified",
    directResponseEvidence: reproduced.directResponseEvidence,
    diagnostics: [],
  };
}
