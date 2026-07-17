import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  DesignSourceGenerationAuthorityBindingV3Schema,
  DesignSourceGenerationDispatchReceiptV3Schema,
  DesignSourceGenerationRequestV3Schema,
  type DesignSourceGenerationDispatchReceiptV3,
  type DesignSourceGenerationRequestV3,
} from "./design-source-generation-request-v3.js";

export const STITCH_DIRECT_PROVIDER_RESPONSE_ARTIFACT_TYPE_V3 =
  "setfarm.stitch-direct-provider-response.v3" as const;
export const STITCH_DIRECT_RESPONSE_EVIDENCE_ARTIFACT_TYPE_V3 =
  "setfarm.stitch-direct-response-evidence.v3" as const;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isStrictlySorted(values: readonly string[]): boolean {
  return values.every((value, index) =>
    index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

const NullableSha256Schema = Sha256Schema.nullable();

export const StitchDirectProviderScreenV3Schema = z.object({
  screenId: z.string().min(1).max(500),
  title: z.string().min(1).max(500),
  responsePaths: z.array(z.string().min(1).max(2_000)).min(1).max(100)
    .refine(hasUniqueStrings, { message: "Provider response paths must be unique" }),
  htmlAvailable: z.boolean(),
  screenshotAvailable: z.boolean(),
  htmlSourceRefHash: NullableSha256Schema,
  screenshotSourceRefHash: NullableSha256Schema,
  htmlDownloadedArtifactHash: NullableSha256Schema,
  screenshotDownloadedArtifactHash: NullableSha256Schema,
}).strict().superRefine((value, context) => {
  for (const [kind, available, sourceHash, downloadedHash] of [
    ["html", value.htmlAvailable, value.htmlSourceRefHash, value.htmlDownloadedArtifactHash],
    [
      "screenshot",
      value.screenshotAvailable,
      value.screenshotSourceRefHash,
      value.screenshotDownloadedArtifactHash,
    ],
  ] as const) {
    if (available !== Boolean(sourceHash)) {
      context.addIssue({
        code: "custom",
        path: [`${kind}SourceRefHash`],
        message: `DIRECT_RESPONSE_V3_${kind.toUpperCase()}_SOURCE_AUTHORITY_MISMATCH: availability must exactly own one source hash`,
      });
    }
    if (!available && downloadedHash !== null) {
      context.addIssue({
        code: "custom",
        path: [`${kind}DownloadedArtifactHash`],
        message: `DIRECT_RESPONSE_V3_${kind.toUpperCase()}_DOWNLOAD_AUTHORITY_MISMATCH: unavailable evidence cannot claim a downloaded artifact`,
      });
    }
  }
});

export type StitchDirectProviderScreenV3 = z.infer<
  typeof StitchDirectProviderScreenV3Schema
>;

export const StitchDirectProviderResponseV3Schema = z.object({
  schema: z.literal(STITCH_DIRECT_PROVIDER_RESPONSE_ARTIFACT_TYPE_V3),
  screens: z.array(StitchDirectProviderScreenV3Schema).min(1).max(1_000),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.screens.map((screen) => screen.screenId))) {
    context.addIssue({
      code: "custom",
      path: ["screens"],
      message: "DIRECT_RESPONSE_V3_PROVIDER_SCREEN_DUPLICATE: provider screen IDs must be unique within one operation",
    });
  }
});

export type StitchDirectProviderResponseV3 = z.infer<
  typeof StitchDirectProviderResponseV3Schema
>;

const StitchDirectScreenEvidenceV3PayloadSchema = z.object({
  requestRef: DesignSourceGenerationRequestV3Schema.shape.requestRef,
  requestReceiptHash: Sha256Schema,
  dispatchReceiptHash: Sha256Schema,
  generationAuthorityHash: Sha256Schema,
  stageId: DesignSourceGenerationRequestV3Schema.shape.stageId,
  targetRef: DesignSourceGenerationRequestV3Schema.shape.targetRef,
  targetHash: Sha256Schema,
  requestScreenKey: z.string().min(1).max(500),
  screenId: z.string().min(1).max(500),
  title: z.string().min(1).max(500),
  responsePaths: z.array(z.string().min(1).max(2_000)).min(1).max(100),
  htmlAvailable: z.boolean(),
  screenshotAvailable: z.boolean(),
  htmlSourceRefHash: NullableSha256Schema,
  screenshotSourceRefHash: NullableSha256Schema,
  htmlDownloadedArtifactHash: NullableSha256Schema,
  screenshotDownloadedArtifactHash: NullableSha256Schema,
  missingEvidence: z.array(z.enum(["html", "screenshot"])).max(2),
  missingDownloadedEvidence: z.array(z.enum(["html", "screenshot"])).max(2),
  disposition: z.enum([
    "admitted_renderable_screen",
    "excluded_missing_render_evidence",
    "excluded_download_failure",
  ]),
  sourceEvidenceHash: Sha256Schema,
}).strict();

export type StitchDirectScreenEvidencePayloadV3 = z.infer<
  typeof StitchDirectScreenEvidenceV3PayloadSchema
>;

export function stitchDirectScreenSourceEvidenceHashV3(
  value: Pick<
    StitchDirectScreenEvidencePayloadV3,
    | "screenId"
    | "title"
    | "responsePaths"
    | "htmlAvailable"
    | "screenshotAvailable"
    | "htmlSourceRefHash"
    | "screenshotSourceRefHash"
    | "htmlDownloadedArtifactHash"
    | "screenshotDownloadedArtifactHash"
  >,
): string {
  return hashCanonicalJson({
    schema: "setfarm.stitch-direct-screen-source-evidence.v3",
    screenId: value.screenId,
    title: value.title,
    responsePaths: value.responsePaths,
    htmlAvailable: value.htmlAvailable,
    screenshotAvailable: value.screenshotAvailable,
    htmlSourceRefHash: value.htmlSourceRefHash,
    screenshotSourceRefHash: value.screenshotSourceRefHash,
    htmlDownloadedArtifactHash: value.htmlDownloadedArtifactHash,
    screenshotDownloadedArtifactHash: value.screenshotDownloadedArtifactHash,
  });
}

export function hashStitchDirectScreenEvidenceV3(
  value: StitchDirectScreenEvidencePayloadV3,
): string {
  return hashCanonicalJson(StitchDirectScreenEvidenceV3PayloadSchema.parse(value));
}

export const StitchDirectScreenEvidenceV3Schema =
  StitchDirectScreenEvidenceV3PayloadSchema.extend({
    candidateHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const providerFields = StitchDirectProviderScreenV3Schema.safeParse({
      screenId: value.screenId,
      title: value.title,
      responsePaths: value.responsePaths,
      htmlAvailable: value.htmlAvailable,
      screenshotAvailable: value.screenshotAvailable,
      htmlSourceRefHash: value.htmlSourceRefHash,
      screenshotSourceRefHash: value.screenshotSourceRefHash,
      htmlDownloadedArtifactHash: value.htmlDownloadedArtifactHash,
      screenshotDownloadedArtifactHash: value.screenshotDownloadedArtifactHash,
    });
    if (!providerFields.success) {
      context.addIssue({
        code: "custom",
        path: ["htmlSourceRefHash"],
        message: `DIRECT_RESPONSE_V3_SOURCE_AUTHORITY_INVALID: ${providerFields.error.issues[0]?.message || "provider evidence mismatch"}`,
      });
    }
    if (!hasUniqueStrings(value.responsePaths) || !isStrictlySorted(value.responsePaths)) {
      context.addIssue({
        code: "custom",
        path: ["responsePaths"],
        message: "DIRECT_RESPONSE_V3_RESPONSE_PATH_ORDER_INVALID: response paths must be unique and canonically sorted",
      });
    }
    const expectedMissing = [
      ...(!value.htmlAvailable ? ["html" as const] : []),
      ...(!value.screenshotAvailable ? ["screenshot" as const] : []),
    ];
    if (JSON.stringify(value.missingEvidence) !== JSON.stringify(expectedMissing)) {
      context.addIssue({
        code: "custom",
        path: ["missingEvidence"],
        message: "DIRECT_RESPONSE_V3_MISSING_EVIDENCE_MISMATCH: missingEvidence must derive from exact provider availability",
      });
    }
    const expectedMissingDownloaded = [
      ...(value.htmlAvailable && value.htmlDownloadedArtifactHash === null
        ? ["html" as const]
        : []),
      ...(value.screenshotAvailable && value.screenshotDownloadedArtifactHash === null
        ? ["screenshot" as const]
        : []),
    ];
    if (
      JSON.stringify(value.missingDownloadedEvidence)
      !== JSON.stringify(expectedMissingDownloaded)
    ) {
      context.addIssue({
        code: "custom",
        path: ["missingDownloadedEvidence"],
        message: "DIRECT_RESPONSE_V3_MISSING_DOWNLOAD_EVIDENCE_MISMATCH: missingDownloadedEvidence must derive from available provider sources without exact downloaded bytes",
      });
    }
    const expectedDisposition = expectedMissing.length > 0
      ? "excluded_missing_render_evidence"
      : expectedMissingDownloaded.length > 0
        ? "excluded_download_failure"
        : "admitted_renderable_screen";
    if (value.disposition !== expectedDisposition) {
      context.addIssue({
        code: "custom",
        path: ["disposition"],
        message: "DIRECT_RESPONSE_V3_DISPOSITION_MISMATCH: disposition must derive from exact render-evidence availability",
      });
    }
    if (value.sourceEvidenceHash !== stitchDirectScreenSourceEvidenceHashV3(value)) {
      context.addIssue({
        code: "custom",
        path: ["sourceEvidenceHash"],
        message: "DIRECT_RESPONSE_V3_SOURCE_EVIDENCE_HASH_MISMATCH: sourceEvidenceHash must bind exact provider-owned fields",
      });
    }
    const { candidateHash: _candidateHash, ...payload } = value;
    if (value.candidateHash !== hashStitchDirectScreenEvidenceV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["candidateHash"],
        message: "DIRECT_RESPONSE_V3_CANDIDATE_HASH_MISMATCH: candidateHash must bind request identity and provider evidence",
      });
    }
  });

export type StitchDirectScreenEvidenceV3 = z.infer<
  typeof StitchDirectScreenEvidenceV3Schema
>;

const StitchDirectResponseOperationPayloadV3Schema = z.object({
  request: DesignSourceGenerationRequestV3Schema,
  dispatchReceipt: DesignSourceGenerationDispatchReceiptV3Schema,
  rawTransportArtifactHash: Sha256Schema,
  providerResponseProjectionHash: Sha256Schema,
  candidates: z.array(StitchDirectScreenEvidenceV3Schema).min(1).max(1_000),
  candidatesHash: Sha256Schema,
}).strict();

export type StitchDirectResponseOperationPayloadV3 = z.infer<
  typeof StitchDirectResponseOperationPayloadV3Schema
>;

export function hashStitchDirectResponseOperationV3(
  value: StitchDirectResponseOperationPayloadV3,
): string {
  return hashCanonicalJson(StitchDirectResponseOperationPayloadV3Schema.parse(value));
}

export const StitchDirectResponseOperationV3Schema =
  StitchDirectResponseOperationPayloadV3Schema.extend({
    operationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const screenIds = value.candidates.map((candidate) => candidate.screenId);
    if (!hasUniqueStrings(screenIds) || !isStrictlySorted(screenIds)) {
      context.addIssue({
        code: "custom",
        path: ["candidates"],
        message: "DIRECT_RESPONSE_V3_CANDIDATE_ORDER_INVALID: operation candidates must be unique and canonically sorted",
      });
    }
    value.candidates.forEach((candidate, candidateIndex) => {
      if (
        candidate.requestRef !== value.request.requestRef
        || candidate.requestReceiptHash !== value.request.receiptHash
        || candidate.dispatchReceiptHash !== value.dispatchReceipt.dispatchReceiptHash
        || candidate.generationAuthorityHash
          !== value.request.generationAuthorityHash
        || candidate.stageId !== value.request.stageId
        || candidate.targetRef !== value.request.targetRef
        || candidate.targetHash !== value.request.targetHash
        || candidate.requestScreenKey !== value.request.requestScreenKey
      ) {
        context.addIssue({
          code: "custom",
          path: ["candidates", candidateIndex],
          message: "DIRECT_RESPONSE_V3_REQUEST_INHERITANCE_MISMATCH: candidate identity must equal its exact compiler-owned request receipt",
        });
      }
    });
    if (
      value.dispatchReceipt.requestRef !== value.request.requestRef
      || value.dispatchReceipt.requestReceiptHash !== value.request.receiptHash
      || value.dispatchReceipt.dispatchedGenerationAuthorityHash
        !== value.request.generationAuthorityHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["dispatchReceipt"],
        message: "DIRECT_RESPONSE_V3_DISPATCH_INHERITANCE_MISMATCH: dispatch receipt must bind the exact request receipt",
      });
    }
    if (value.candidatesHash !== hashCanonicalJson(value.candidates)) {
      context.addIssue({
        code: "custom",
        path: ["candidatesHash"],
        message: "DIRECT_RESPONSE_V3_CANDIDATES_HASH_MISMATCH: candidatesHash must bind the exact ordered candidates",
      });
    }
    const { operationHash: _operationHash, ...payload } = value;
    if (value.operationHash !== hashStitchDirectResponseOperationV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["operationHash"],
        message: "DIRECT_RESPONSE_V3_OPERATION_HASH_MISMATCH: operationHash must bind request, exact raw transport artifact, strict response projection, and candidates",
      });
    }
  });

export type StitchDirectResponseOperationV3 = z.infer<
  typeof StitchDirectResponseOperationV3Schema
>;

const StitchDirectResponseEvidencePayloadV3Schema = z.object({
  schema: z.literal(STITCH_DIRECT_RESPONSE_EVIDENCE_ARTIFACT_TYPE_V3),
  generationTargetsPayloadHash: Sha256Schema,
  generationAuthority: DesignSourceGenerationAuthorityBindingV3Schema,
  requestsHash: Sha256Schema,
  dispatchReceiptsHash: Sha256Schema,
  operations: z.array(StitchDirectResponseOperationV3Schema).min(1).max(1_000),
  operationsHash: Sha256Schema,
}).strict();

export type StitchDirectResponseEvidencePayloadV3 = z.infer<
  typeof StitchDirectResponseEvidencePayloadV3Schema
>;

export function hashStitchDirectResponseEvidenceV3(
  value: StitchDirectResponseEvidencePayloadV3,
): string {
  return hashCanonicalJson(StitchDirectResponseEvidencePayloadV3Schema.parse(value));
}

export const StitchDirectResponseEvidenceV3Schema =
  StitchDirectResponseEvidencePayloadV3Schema.extend({
    payloadHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const targetRefs = value.operations.map((operation) => operation.request.targetRef);
    const requestRefs = value.operations.map((operation) => operation.request.requestRef);
    const stageIds = value.operations.map((operation) => operation.request.stageId);
    for (const [field, values] of [
      ["targetRef", targetRefs],
      ["requestRef", requestRefs],
      ["stageId", stageIds],
    ] as const) {
      if (!hasUniqueStrings(values)) {
        context.addIssue({
          code: "custom",
          path: ["operations"],
          message: `DIRECT_RESPONSE_V3_${field.toUpperCase()}_DUPLICATE: ${field} identities must be globally unique`,
        });
      }
    }
    if (!isStrictlySorted(targetRefs)) {
      context.addIssue({
        code: "custom",
        path: ["operations"],
        message: "DIRECT_RESPONSE_V3_OPERATION_ORDER_INVALID: operations must be canonically sorted by targetRef",
      });
    }
    value.operations.forEach((operation, operationIndex) => {
      if (operation.request.generationTargetsPayloadHash !== value.generationTargetsPayloadHash) {
        context.addIssue({
          code: "custom",
          path: ["operations", operationIndex, "request", "generationTargetsPayloadHash"],
          message: "DIRECT_RESPONSE_V3_TARGETS_AUTHORITY_MISMATCH: every request must bind the parent generation-target payload",
        });
      }
      if (
        operation.request.generationAuthorityHash
        !== value.generationAuthority.authorityHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["operations", operationIndex, "request", "generationAuthority"],
          message: "DIRECT_RESPONSE_V3_GENERATION_AUTHORITY_MISMATCH: every request must bind one exact provider/model/device/policy/release authority",
        });
      }
    });
    if (value.requestsHash !== hashCanonicalJson(
      value.operations.map((operation) => operation.request),
    )) {
      context.addIssue({
        code: "custom",
        path: ["requestsHash"],
        message: "DIRECT_RESPONSE_V3_REQUESTS_HASH_MISMATCH: requestsHash must bind the exact ordered request receipts",
      });
    }
    if (value.dispatchReceiptsHash !== hashCanonicalJson(
      value.operations.map((operation) => operation.dispatchReceipt),
    )) {
      context.addIssue({
        code: "custom",
        path: ["dispatchReceiptsHash"],
        message: "DIRECT_RESPONSE_V3_DISPATCH_RECEIPTS_HASH_MISMATCH: dispatchReceiptsHash must bind the exact ordered dispatch receipts",
      });
    }
    if (value.operationsHash !== hashCanonicalJson(value.operations)) {
      context.addIssue({
        code: "custom",
        path: ["operationsHash"],
        message: "DIRECT_RESPONSE_V3_OPERATIONS_HASH_MISMATCH: operationsHash must bind the exact ordered operations",
      });
    }
    const { payloadHash: _payloadHash, ...payload } = value;
    if (value.payloadHash !== hashStitchDirectResponseEvidenceV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["payloadHash"],
        message: "DIRECT_RESPONSE_V3_PAYLOAD_HASH_MISMATCH: payloadHash must bind the exact canonical response authority",
      });
    }
  });

export type StitchDirectResponseEvidenceV3 = z.infer<
  typeof StitchDirectResponseEvidenceV3Schema
>;

export function requestReceiptsHashV3(
  requests: readonly DesignSourceGenerationRequestV3[],
): string {
  return hashCanonicalJson(requests);
}

export function dispatchReceiptsHashV3(
  receipts: readonly DesignSourceGenerationDispatchReceiptV3[],
): string {
  return hashCanonicalJson(receipts);
}
