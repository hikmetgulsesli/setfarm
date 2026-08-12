import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  ContentAddressedArtifactStore,
} from "../product-compiler/artifact-store.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
} from "../product-compiler/artifact-store-batch-plan.js";
import {
  SemanticArtifactEnvelopeV1Schema,
  type SemanticArtifactEnvelopeV1,
} from "../product-compiler/artifact-envelope.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  SemanticArtifactProducerV1Schema,
  type SemanticArtifactProducerV1,
} from "../product-compiler/schemas/common-v1.js";
import {
  EVIDENCE_CAPTURE_REF_V2_SCHEMA,
  EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2,
  EVIDENCE_CAPTURE_V2_MAX_BYTES,
  EvidenceReceiptCandidateV2Schema,
  evidenceCaptureRedactionPolicyHashV2,
  type EvidenceCaptureRefV2,
  type EvidenceReceiptCandidateV2,
} from "./schemas/evidence-receipt-v2.js";
import {
  DURABLE_EVIDENCE_EXECUTION_RESULT_V2_SCHEMA,
  EVIDENCE_CAPTURE_PAYLOAD_V2_SCHEMA,
  hashDurableEvidenceExecutionResultV2,
  parseDurableEvidenceExecutionResultV2,
  type DurableEvidenceExecutionResultHashPayloadV2,
  type DurableEvidenceExecutionResultV2,
} from "./schemas/evidence-runner-v2.js";

const EVIDENCE_CAPTURE_ARTIFACT_TYPE_V2 =
  "setfarm.evidence-capture.v2" as const;

export type DurableEvidencePublicationErrorCodeV2 =
  | "DURABLE_EVIDENCE_PUBLICATION_V2_INPUT_INVALID"
  | "DURABLE_EVIDENCE_PUBLICATION_V2_CAPTURE_REJECTED"
  | "DURABLE_EVIDENCE_PUBLICATION_V2_RECEIPT_REJECTED"
  | "DURABLE_EVIDENCE_PUBLICATION_V2_CAS_REJECTED";

export class DurableEvidencePublicationErrorV2 extends Error {
  readonly code: DurableEvidencePublicationErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: DurableEvidencePublicationErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "DurableEvidencePublicationErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: DurableEvidencePublicationErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new DurableEvidencePublicationErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactStandaloneStoreForTest(
  value: unknown,
): ContentAddressedArtifactStore {
  if (
    typeof value !== "object"
    || value === null
    || isProxy(value)
    || Object.getPrototypeOf(value)
      !== ContentAddressedArtifactStore.prototype
    || Object.prototype.hasOwnProperty.call(value, "put")
    || Object.prototype.hasOwnProperty.call(value, "get")
    || Object.prototype.hasOwnProperty.call(value, "putPreparedBatch")
  ) {
    return fail(
      "DURABLE_EVIDENCE_PUBLICATION_V2_INPUT_INVALID",
      "Shadow evidence publication requires one exact standalone CAS test authority",
    );
  }
  return value as ContentAddressedArtifactStore;
}

export type EvidenceCaptureInputV2 = Readonly<{
  channelRef: string;
  mediaType: "application/json" | "application/octet-stream" | "text/plain";
  bytes: Buffer;
}>;

function redactedCaptureV2(
  input: EvidenceCaptureInputV2,
): Readonly<{
  bytes: Buffer;
  contentHash: string;
  byteLength: number;
}> {
  if (
    !/^[A-Z][A-Z0-9_]*_V2$/u.test(input.channelRef)
    || !Buffer.isBuffer(input.bytes)
    || input.bytes.byteLength > EVIDENCE_CAPTURE_V2_MAX_BYTES
  ) {
    return fail(
      "DURABLE_EVIDENCE_PUBLICATION_V2_CAPTURE_REJECTED",
      "Evidence capture input is not one bounded code-owned channel",
    );
  }
  let bytes = Buffer.from(input.bytes);
  if (input.mediaType !== "application/octet-stream") {
    const text = bytes.toString("utf8");
    if (Buffer.from(text, "utf8").compare(bytes) !== 0) {
      bytes.fill(0);
      return fail(
        "DURABLE_EVIDENCE_PUBLICATION_V2_CAPTURE_REJECTED",
        "Text evidence capture is not exact UTF-8",
      );
    }
    const redacted = text
      .replace(
        /(^|\n)(authorization|cookie|proxy-authorization|set-cookie|x-api-key)\s*:[^\r\n]*/giu,
        "$1$2:[REDACTED]",
      )
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gu, "Bearer [REDACTED]")
      .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gu, "sk-[REDACTED]");
    bytes.fill(0);
    bytes = Buffer.from(redacted, "utf8");
  }
  return Object.freeze({
    bytes,
    contentHash: sha256(bytes),
    byteLength: bytes.byteLength,
  });
}

function captureEnvelopeV2(
  input: EvidenceCaptureInputV2,
  producer: SemanticArtifactProducerV1,
): Readonly<{
  envelope: SemanticArtifactEnvelopeV1;
  contentHash: string;
  byteLength: number;
  mediaType: EvidenceCaptureInputV2["mediaType"];
  bytes: Buffer;
}> {
  const captured = redactedCaptureV2(input);
  const envelope = SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: EVIDENCE_CAPTURE_ARTIFACT_TYPE_V2,
    producer,
    payload: {
      schema: EVIDENCE_CAPTURE_PAYLOAD_V2_SCHEMA,
      channelRef: input.channelRef,
      mediaType: input.mediaType,
      encoding: "base64",
      contentHash: captured.contentHash,
      byteLength: captured.byteLength,
      bodyBase64: captured.bytes.toString("base64"),
      redaction: {
        policyRef: EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2,
        policyHash: evidenceCaptureRedactionPolicyHashV2(),
        secretsRemoved: true,
        mutableLocatorStored: false,
      },
    },
  });
  return Object.freeze({
    envelope,
    contentHash: captured.contentHash,
    byteLength: captured.byteLength,
    mediaType: input.mediaType,
    bytes: captured.bytes,
  });
}

export type CandidateEvidencePublicationInputV2 = Readonly<{
  store: ContentAddressedArtifactStore;
  producer: SemanticArtifactProducerV1;
  runnerEntrypointRef:
    | "ENTRY_EVIDENCE_CLI_PROCESS_V2"
    | "ENTRY_EVIDENCE_COMMAND_V2"
    | "ENTRY_EVIDENCE_HTTP_SERVICE_V2";
  captures: readonly EvidenceCaptureInputV2[];
  createReceipt: (
    captures: readonly EvidenceCaptureRefV2[],
  ) => EvidenceReceiptCandidateV2;
}>;

/**
 * @internal Shadow-only publication kernel. The future activated runner uses
 * the same deterministic envelope construction behind a hybrid writer and an
 * activation-generation compare-and-set; this test seam cannot claim either.
 */
export async function publishCandidateEvidenceV2ForTest(
  input: CandidateEvidencePublicationInputV2,
): Promise<DurableEvidenceExecutionResultV2> {
  const store = exactStandaloneStoreForTest(input.store);
  const producer = SemanticArtifactProducerV1Schema.parse(input.producer);
  if (
    input.captures.length < 1
    || input.captures.length > 32
    || new Set(input.captures.map((capture) => capture.channelRef)).size
      !== input.captures.length
  ) {
    return fail(
      "DURABLE_EVIDENCE_PUBLICATION_V2_INPUT_INVALID",
      "Evidence publication requires 1..32 unique code-owned capture channels",
    );
  }
  const captured = input.captures.map(
    (capture) => captureEnvelopeV2(capture, producer),
  );
  const capturedByEnvelopeHash = new Map(
    captured.map((entry) => [hashCanonicalJson(entry.envelope), entry]),
  );
  if (capturedByEnvelopeHash.size !== captured.length) {
    return fail(
      "DURABLE_EVIDENCE_PUBLICATION_V2_CAPTURE_REJECTED",
      "Distinct capture channels produced colliding envelope identities",
    );
  }
  let firstPreparedItems:
    ReturnType<typeof copyPreparedArtifactStoreBatchCanonicalItemsV1>
    | undefined;
  let finalPreparedItems:
    ReturnType<typeof copyPreparedArtifactStoreBatchCanonicalItemsV1>
    | undefined;
  try {
    const capturePrepared = prepareArtifactStoreBatchPlanV1({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: captured.map((entry) => ({
        durabilityTier: 0,
        envelope: entry.envelope,
      })),
    });
    firstPreparedItems =
      copyPreparedArtifactStoreBatchCanonicalItemsV1(capturePrepared);
    if (firstPreparedItems.length !== captured.length) {
      return fail(
        "DURABLE_EVIDENCE_PUBLICATION_V2_CAPTURE_REJECTED",
        "Capture preparation did not preserve exact cardinality",
      );
    }
    const captureRefs = firstPreparedItems.map((item) => {
      const entry = capturedByEnvelopeHash.get(item.identity.hash);
      if (!entry) {
        return fail(
          "DURABLE_EVIDENCE_PUBLICATION_V2_CAPTURE_REJECTED",
          "Prepared capture cannot be joined to its content-addressed envelope",
        );
      }
      return {
        schema: EVIDENCE_CAPTURE_REF_V2_SCHEMA,
        artifactEnvelopeHash: item.identity.hash,
        contentHash: entry.contentHash,
        byteLength: entry.byteLength,
        mediaType: entry.mediaType,
        encoding: "identity" as const,
        redaction: {
          policyRef: EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2,
          policyHash: evidenceCaptureRedactionPolicyHashV2(),
          secretsRemoved: true as const,
          mutableLocatorStored: false as const,
        },
      };
    }).sort((left, right) =>
      left.artifactEnvelopeHash.localeCompare(right.artifactEnvelopeHash));
    const receipt = EvidenceReceiptCandidateV2Schema.parse(
      input.createReceipt(Object.freeze(captureRefs)),
    );
    const receiptEnvelope = SemanticArtifactEnvelopeV1Schema.parse({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.evidence-receipt.v2",
      producer,
      payload: receipt,
    });
    const finalPrepared = prepareArtifactStoreBatchPlanV1({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [
        ...captured.map((entry) => ({
          durabilityTier: 0,
          envelope: entry.envelope,
        })),
        {
          durabilityTier: 1,
          envelope: receiptEnvelope,
        },
      ],
    });
    finalPreparedItems =
      copyPreparedArtifactStoreBatchCanonicalItemsV1(finalPrepared);
    const receiptPreparedItem = finalPreparedItems[captured.length];
    if (
      !receiptPreparedItem
      || finalPreparedItems.length !== captured.length + 1
      || finalPreparedItems.slice(0, captured.length).some(
        (item, index) =>
          item.identity.hash !== firstPreparedItems![index]!.identity.hash,
      )
    ) {
      return fail(
        "DURABLE_EVIDENCE_PUBLICATION_V2_RECEIPT_REJECTED",
        "Receipt preparation did not preserve exact capture identities",
      );
    }
    const publication = await store.putPreparedBatch(finalPrepared);
    if (
      publication.planIdentityHash !== finalPrepared.planIdentityHash
      || publication.items.length !== finalPreparedItems.length
      || publication.items.some(
        (item, index) =>
          item.hash !== finalPreparedItems![index]!.identity.hash
          || item.byteLength
            !== finalPreparedItems![index]!.identity.byteLength,
      )
    ) {
      return fail(
        "DURABLE_EVIDENCE_PUBLICATION_V2_CAS_REJECTED",
        "CAS publication result differs from the exact prepared evidence batch",
      );
    }
    for (let index = 0; index < finalPreparedItems.length; index += 1) {
      const expected = finalPreparedItems[index]!;
      const stored = await store.get(expected.identity.hash);
      try {
        const expectedCapture =
          capturedByEnvelopeHash.get(expected.identity.hash);
        const expectedEnvelope = index === captured.length
          ? receiptEnvelope
          : expectedCapture?.envelope;
        if (
          !expectedEnvelope
          || !stored.bytes.equals(expected.bytes)
          || canonicalJsonStringify(stored.envelope)
            !== canonicalJsonStringify(expectedEnvelope)
        ) {
          return fail(
            "DURABLE_EVIDENCE_PUBLICATION_V2_CAS_REJECTED",
            "Fresh CAS read does not reproduce the exact durable evidence bytes",
          );
        }
      } finally {
        stored.bytes.fill(0);
      }
    }
    const identity: DurableEvidenceExecutionResultHashPayloadV2 = {
      schema: DURABLE_EVIDENCE_EXECUTION_RESULT_V2_SCHEMA,
      version: "2.0.0",
      authorityState: receipt.authorityState,
      productionUse: receipt.productionUse,
      runnerEntrypointRef: input.runnerEntrypointRef,
      publication: {
        state: "durable_cas_verified",
        planIdentityHash: finalPrepared.planIdentityHash,
        captureEnvelopeHashes: captureRefs.map(
          (capture) => capture.artifactEnvelopeHash,
        ),
        receiptEnvelopeHash: receiptPreparedItem.identity.hash,
        receiptHash: receipt.receiptHash,
      },
      receipt,
    };
    return parseDurableEvidenceExecutionResultV2({
      ...identity,
      resultHash: hashDurableEvidenceExecutionResultV2(identity),
    });
  } catch (error) {
    if (error instanceof DurableEvidencePublicationErrorV2) throw error;
    return fail(
      "DURABLE_EVIDENCE_PUBLICATION_V2_CAS_REJECTED",
      "Evidence publication failed at one typed durable CAS boundary",
      error,
    );
  } finally {
    for (const entry of captured) entry.bytes.fill(0);
    firstPreparedItems?.forEach((item) => item.bytes.fill(0));
    finalPreparedItems?.forEach((item) => item.bytes.fill(0));
  }
}
