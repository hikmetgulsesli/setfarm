import { Buffer } from "node:buffer";

import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import { Sha256Schema } from "./schemas/common-v1.js";

export const STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1 = Object.freeze({
  schema: "setfarm.stitch-stage-provider-rejection-policy.v1" as const,
  maximumDiagnosticCodeUnits: 700,
  maximumCanonicalEnvelopeBytes: 4 * 1024,
  redactionPolicy: "aq-credential-token-redaction.v1" as const,
});

const DiagnosticSchema = z.string()
  .min(1)
  .max(STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1.maximumDiagnosticCodeUnits)
  .superRefine((value, context) => {
    if (value !== value.replace(/\s+/g, " ").trim()) {
      context.addIssue({
        code: "custom",
        message: "STITCH_PROVIDER_REJECTION_DIAGNOSTIC_NOT_CANONICAL",
      });
    }
    const authorizationValues = [...value.matchAll(
      /\bauthorization\s*[:=]\s*([^\r\n]*)/gi,
    )].map((match) => match[1]?.trim());
    const bearerValues = [...value.matchAll(
      /\bbearer\s*[:=]\s*([^\r\n]*)/gi,
    )].map((match) => match[1]?.trim());
    if (
      /AQ\.(?!\[REDACTED\])[A-Za-z0-9_-]+/.test(value)
      || /(api[_-]?key|token)\s*[:=]\s*(?!\[REDACTED\])[^\s,}]+/i.test(value)
      || /\bbearer\s+[^\s,}]+/i.test(value)
      || authorizationValues.some((authorization) => authorization !== "[REDACTED]")
      || bearerValues.some((bearer) => bearer !== "[REDACTED]")
    ) {
      context.addIssue({
        code: "custom",
        message: "STITCH_PROVIDER_REJECTION_DIAGNOSTIC_NOT_REDACTED",
      });
    }
  });

export const StitchStageProviderRejectionV1Schema = z.object({
  schema: z.literal("setfarm.stitch-stage-provider-rejection.v1"),
  classification: z.literal("explicit_mcp_error_before_accepted_result"),
  tool: z.literal("generate_screen_from_text"),
  isError: z.literal(true),
  acceptedResult: z.literal(false),
  acceptedScreenIds: z.tuple([]),
  acceptedArtifactLocators: z.tuple([]),
  diagnosticCode: z.literal("STITCH_MCP_TOOL_ERROR"),
  diagnostic: DiagnosticSchema,
  diagnosticHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expected = hashCanonicalJson({
    schema: "setfarm.stitch-stage-provider-rejection-diagnostic.v1",
    diagnostic: value.diagnostic,
  });
  if (value.diagnosticHash !== expected) {
    context.addIssue({
      code: "custom",
      path: ["diagnosticHash"],
      message: "STITCH_PROVIDER_REJECTION_DIAGNOSTIC_HASH_MISMATCH",
    });
  }
});

export type StitchStageProviderRejectionV1 = z.infer<
  typeof StitchStageProviderRejectionV1Schema
>;

export function canonicalStitchStageProviderRejectionV1(value: unknown): string {
  const parsed = StitchStageProviderRejectionV1Schema.parse(value);
  const canonical = canonicalJsonStringify(parsed);
  if (Buffer.byteLength(canonical, "utf8")
    > STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1.maximumCanonicalEnvelopeBytes) {
    throw new Error("STITCH_PROVIDER_REJECTION_ENVELOPE_CAPACITY_EXCEEDED");
  }
  return canonical;
}

export function parseStitchStageProviderRejectionProcessEnvelopeV1(input: Readonly<{
  stdout: string;
  stderr: string;
}>): StitchStageProviderRejectionV1 {
  if (input.stdout !== "") {
    throw new Error("STITCH_PROVIDER_REJECTION_STDOUT_NOT_EMPTY");
  }
  if (Buffer.byteLength(input.stderr, "utf8")
    > STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1.maximumCanonicalEnvelopeBytes + 1) {
    throw new Error("STITCH_PROVIDER_REJECTION_ENVELOPE_CAPACITY_EXCEEDED");
  }
  if (!input.stderr.endsWith("\n") || input.stderr.endsWith("\n\n")) {
    throw new Error("STITCH_PROVIDER_REJECTION_STDERR_NOT_EXACT");
  }
  const body = input.stderr.slice(0, -1);
  if (body.length === 0 || body.includes("\n") || body.includes("\r")) {
    throw new Error("STITCH_PROVIDER_REJECTION_STDERR_NOT_EXACT");
  }
  const parsed = StitchStageProviderRejectionV1Schema.parse(JSON.parse(body));
  if (`${canonicalStitchStageProviderRejectionV1(parsed)}\n` !== input.stderr) {
    throw new Error("STITCH_PROVIDER_REJECTION_STDERR_NOT_CANONICAL");
  }
  return parsed;
}
