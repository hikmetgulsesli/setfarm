import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../../execution/schemas/platform-release-common-v2.js";
import {
  EvidenceReceiptV2Schema,
} from "./evidence-receipt-v2.js";

export const DURABLE_EVIDENCE_EXECUTION_RESULT_V2_SCHEMA =
  "setfarm.durable-evidence-execution-result.v2" as const;
export const EVIDENCE_CAPTURE_PAYLOAD_V2_SCHEMA =
  "setfarm.evidence-capture-payload.v2" as const;
export const DURABLE_EVIDENCE_EXECUTION_RESULT_V2_MAX_CANONICAL_BYTES =
  512 * 1024;

export const EVIDENCE_RUNNER_ENTRYPOINT_REFS_V2 = Object.freeze([
  "ENTRY_EVIDENCE_CLI_PROCESS_V2",
  "ENTRY_EVIDENCE_COMMAND_V2",
  "ENTRY_EVIDENCE_HTTP_SERVICE_V2",
] as const);

const RunnerEntrypointRefV2Schema = z.enum(
  EVIDENCE_RUNNER_ENTRYPOINT_REFS_V2,
);

const DurableEvidencePublicationV2Schema = z.object({
  state: z.literal("durable_cas_verified"),
  planIdentityHash: Sha256Schema,
  captureEnvelopeHashes: z.array(Sha256Schema)
    .min(1)
    .max(32)
    .refine(
      (values) => new Set(values).size === values.length,
      "Published capture envelope hashes must be unique",
    )
    .refine(
      (values) => values.every(
        (value, index) => index === 0 || values[index - 1]! < value,
      ),
      "Published capture envelope hashes must be canonically sorted",
    ),
  receiptEnvelopeHash: Sha256Schema,
  receiptHash: Sha256Schema,
}).strict();

const DurableEvidenceExecutionResultIdentityV2Schema = z.object({
  schema: z.literal(DURABLE_EVIDENCE_EXECUTION_RESULT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.enum([
    "candidate_unverified",
    "activated_release_bound",
  ]),
  productionUse: z.enum([
    "forbidden",
    "permitted_current_activation_lease_only",
  ]),
  runnerEntrypointRef: RunnerEntrypointRefV2Schema,
  publication: DurableEvidencePublicationV2Schema,
  receipt: EvidenceReceiptV2Schema,
}).strict().superRefine((value, context) => {
  if (
    value.authorityState !== value.receipt.authorityState
    || value.productionUse !== value.receipt.productionUse
    || value.publication.receiptHash !== value.receipt.receiptHash
    || value.publication.captureEnvelopeHashes.length
      !== value.receipt.captures.length
    || value.publication.captureEnvelopeHashes.some(
      (hash, index) =>
        hash !== value.receipt.captures[index]!.artifactEnvelopeHash,
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "Durable result must close its exact receipt authority and every published capture",
    });
  }
  const expectedRunnerRef =
    value.receipt.operation.kind === "command"
      ? "ENTRY_EVIDENCE_COMMAND_V2"
      : value.receipt.operation.kind === "cli_process"
        ? "ENTRY_EVIDENCE_CLI_PROCESS_V2"
        : "ENTRY_EVIDENCE_HTTP_SERVICE_V2";
  if (value.runnerEntrypointRef !== expectedRunnerRef) {
    context.addIssue({
      code: "custom",
      path: ["runnerEntrypointRef"],
      message: "Durable result runner must equal the receipt operation owner",
    });
  }
});

export type DurableEvidenceExecutionResultHashPayloadV2 = z.infer<
  typeof DurableEvidenceExecutionResultIdentityV2Schema
>;

export function hashDurableEvidenceExecutionResultV2(
  value:
    | DurableEvidenceExecutionResultHashPayloadV2
    | DurableEvidenceExecutionResultV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.resultHash;
  return hashCanonicalJson({
    schema: "setfarm.durable-evidence-execution-result-hash.v2",
    result: payload,
  });
}

export const DurableEvidenceExecutionResultV2Schema =
  DurableEvidenceExecutionResultIdentityV2Schema.extend({
    resultHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      DURABLE_EVIDENCE_EXECUTION_RESULT_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: "Durable evidence execution result exceeds its canonical byte cap",
      });
      return;
    }
    if (value.resultHash !== hashDurableEvidenceExecutionResultV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["resultHash"],
        message: "Durable evidence execution result hash mismatch",
      });
    }
  });

export type DurableEvidenceExecutionResultV2 = z.infer<
  typeof DurableEvidenceExecutionResultV2Schema
>;

export function parseDurableEvidenceExecutionResultV2(
  input: unknown,
): DurableEvidenceExecutionResultV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    DURABLE_EVIDENCE_EXECUTION_RESULT_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    DurableEvidenceExecutionResultV2Schema.parse(snapshot),
  );
}
